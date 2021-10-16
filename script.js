(function () {
  var keysLoaded = false;
  var amiiboDatabase = null;
  var amiiboZip = null;
  var g_data = null;
  var api_amiibo_list = null;

  function create_api_amiibo(data) {
    return {
      amiiboName: data.name.toString(),
      amiiboId: data.head.toString() + data.tail.toString(),
      seriesName: data.amiiboSeries.toString(),
      imageURL: data.image,
      characterName: data.character,
    };
  }

  function build_amiibo(api_amiibo, name) {
    let amiibo = {
      uuid: new Uint8Array(Array(10).fill(0)),
      writeCounter: 0,
      version: 0,
    };

    amiibo.name = name;
    amiibo.miiCharInfoFileName = "mii-charinfo.bin";

    let cur_date = new Date();
    let firstWriteDate = {
      y: cur_date.getFullYear(),
      m: cur_date.getMonth() + 1,
      d: cur_date.getDate(),
    };
    let lastWriteDate = {
      y: cur_date.getFullYear(),
      m: cur_date.getMonth() + 1,
      d: cur_date.getDate(),
    };

    amiibo.firstWriteDate = firstWriteDate;
    amiibo.lastWriteDate = lastWriteDate;

    let id = api_amiibo.amiiboId;
    let character_game_id_str = id.substr(0, 4);
    let character_variant_str = id.substr(4, 2);
    let figure_type_str = id.substr(6, 2);
    let model_no_str = id.substr(8, 4);
    let series_str = id.substr(12, 2);

    // swap endianness for this number
    let character_game_id_be = character_game_id_str.split("").reverse();
    let temp = character_game_id_be[0];
    character_game_id_be[0] = character_game_id_be[1];
    character_game_id_be[1] = temp;
    temp = character_game_id_be[2];
    character_game_id_be[2] = character_game_id_be[3];
    character_game_id_be[3] = temp;
    window.crypto.getRandomValues(amiibo.uuid);
    amiibo.uuid[7] = 0;
    amiibo.uuid[8] = 0;
    amiibo.uuid[9] = 0;
    amiibo.id = {
      characterId: {
        gameCharacterId: character_game_id_be.join(""),
        characterVariant: character_variant_str,
      },
      figureType: figure_type_str,
      modelNumber: model_no_str,
      series: series_str,
    };
    // uuid
    return amiibo;
  }

  function emuiibo_json(amiibo) {
    let uuid = amiibo.uuid
      .map((el) => el.toString())
      .join(",")
      .split(",")
      .map((el) => Number.parseInt(el, 10));
    let val = {
      name: amiibo.name,
      write_counter: amiibo.writeCounter,
      version: amiibo.version,
      mii_charinfo_file: amiibo.miiCharInfoFileName,
      first_write_date: amiibo.firstWriteDate,
      last_write_date: amiibo.lastWriteDate,
      id: {
        game_character_id: Number.parseInt(
          amiibo.id.characterId.gameCharacterId,
          16
        ),
        character_variant: Number.parseInt(
          amiibo.id.characterId.characterVariant,
          16
        ),
        figure_type: Number.parseInt(amiibo.id.figureType, 16),
        series: Number.parseInt(amiibo.id.series, 16),
        model_number: Number.parseInt(amiibo.id.modelNumber, 16),
      },
      uuid: uuid,
    };
    return JSON.stringify(val, null, 4);
  }

  // const json_file='https://raw.githubusercontent.com/N3evin/AmiiboAPI/master/database/amiibo.json';
  const amiibo_api = "https://www.amiiboapi.com/api/amiibo";
  function populateTable() {
    $.getJSON(amiibo_api, function (data) {
      amiiboDatabase = data;
      g_data = data;
      api_amiibo_list = {};
      var t = $("#dataTable").DataTable();
      data.amiibo.forEach(function (item) {
        api_amiibo_list[item.name] = create_api_amiibo(item);
        var image = `<div class="amiibo-image"><img src="${item.image}" /></div>`;
        t.row.add([
          image,
          `<span class="table-text">${item.name}</span>`,
          `<span class="table-text">${item.head + item.tail}</span>`,
        ]);
      });
      t.draw(false);
      generateZip();
    });
  }

  function generateJsonFile(name) {
    let api_amiibo = api_amiibo_list[name];
    if (api_amiibo) {
      let amiibo = build_amiibo(api_amiibo, name);
      let json = emuiibo_json(amiibo);
      console.log(json);
      return json;
    }
    return "";
  }

  function downloadJsonFile(name) {
    var data = generateJsonFile(name);

    file = name + ".json";
    console.log("download " + file);

    download(
      "data:text/json;charset=utf-8," + encodeURIComponent(data),
      file,
      "application/octet-stream"
    );
  }

  function generateZip() {
    const specialCharacters = ["<", ">", ":", '"', "/", "\\", "|", "?", "*"];
    var zip = new JSZip();
    Object.keys(amiiboDatabase.amiibo).forEach(function (item) {
      let filename = item.name + ".json";

      specialCharacters.forEach(function (char) {
        filename = filename.replace(char, "_");
      });

      var folder = zip.folder(item.gameSeries);
      folder.file(filename, generateJsonFile(item.name));
    });

    zip.generateAsync({ type: "blob" }).then(function (content) {
      amiiboZip = content;
      $(".hide_until_zipped").removeClass("hide_until_zipped");
      $("a#downloadZip").click(function (e) {
        e.preventDefault();
        download(amiiboZip, "amiibo.zip", "application/octet-stream");
      });
    });
  }

  // Run on page load
  $(function () {
    populateTable();
    oTable = $("#dataTable").DataTable({
      lengthMenu: [
        [10, 25, 50, 100, -1],
        [10, 25, 50, 100, "All"],
      ],
    });

    $("#dataTable tbody").on("click", "tr", function () {
      var data = oTable.row(this).data();
      downloadJsonFile($(data[1]).text());
    });

    $("#input").keyup(function () {
      oTable
        .search(jQuery.fn.DataTable.ext.type.search.string($(this).val()))
        .draw();
    });
  });
})();
