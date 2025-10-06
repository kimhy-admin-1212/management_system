let supabase; // 👈 biến toàn cục

(async function () {
  supabase = window.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_KEY
  );

  const user = JSON.parse(localStorage.getItem("userInfo"));
  if (!user || !user.username || user.role === 1) {
    window.location.href = "/RSVP_admin/login.html";
    return;
  }

  const user2 = user; // Gán lại nếu cần, nhưng bạn có thể dùng luôn `user`

  let allThemes = [];

  async function loadDataFromTable() {
    const { data, error } = await supabase
      .from("music_list")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      document.getElementById(
        "rsvpTableBody"
      ).innerHTML = `<tr><td colspan="4">⚠️ Lỗi tải dữ liệu từ music_list</td></tr>`;
      console.error(error.message);
      return;
    }

    allThemes = data;
    renderData(allThemes);
  }

  function renderData(data) {
    const tbody = document.getElementById("rsvpTableBody");
    tbody.innerHTML = "";

    data.forEach((item, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="p-2 text-center">${index + 1}</td>
        <td class="p-2 text-center">${item.name_display}</td>
        <td class="p-2 text-center">${item.file_url}</td>

        <td class="p-2 align-middle bg-transparent border-b-0 whitespace-nowrap shadow-transparent text-center adminOnly">
        <a class="text-xs font-semibold leading-tight dark:text-white dark:opacity-80 text-slate-400" href="#" onclick="editTheme(${
          item.id
        })">✏️ Sửa</a>
          <a class="text-xs font-semibold leading-tight dark:text-white dark:opacity-80 text-slate-400" href="#"
            onclick="deleteEntry(${item.id}, '${item.name_display.replace(
        /'/g,
        "\\'"
      )}')">🗑️ Xoá</a>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // 👇 Xử lý ẩn/hiện sau khi render
    document.querySelectorAll(".adminOnly").forEach((el) => {
      el.style.display = user2?.role === 0 ? "table-cell" : "none";
    });
  }

  // ✅ Event xoá
  window.deleteEntry = async function (id, name) {
    if (!confirm("Bạn có chắc muốn xoá " + name + " không?")) return;

    const { error } = await supabase.from("music_list").delete().eq("id", id);

    if (error) {
      alert("❌ Xoá thất bại: " + error.message);
      return;
    }

    await loadDataFromTable();
    // Nếu không có `loadChartFromTable`, bạn có thể bỏ dòng dưới:
    // await loadChartFromTable(window.currentTable);
  };

  // ✅ Load lần đầu
  await loadDataFromTable();

  window.editTheme = function (id) {
    const user = allThemes.find((u) => u.id === id);
    if (!user) return alert("Không tìm thấy user");

    document.getElementById("editId").value = user.id;
    document.getElementById("editNameDisplay").value = user.name_display;
    document.getElementById("editFileURL").value = user.file_url;

    document.getElementById("editPopupOverlay").style.display = "flex";
  };

  window.saveEdit = async function () {
    const id = document.getElementById("editId").value;
    const name_display = document
      .getElementById("editNameDisplay")
      .value.trim();
    const file_url = document.getElementById("editFileURL").value.trim();

    const { error } = await supabase
      .from("music_list")
      .update({ name_display, file_url })
      .eq("id", id);

    if (error) {
      alert("❌ Lỗi khi cập nhật: " + error.message);
      return;
    }

    closePopup();
    await loadDataFromTable();
  };

  window.openAddPopup = function () {
    document.getElementById("addNameDisplay").value = "";
    document.getElementById("addFileURL").value = "";
    document.getElementById("addPopupOverlay").style.display = "flex";
  };
  window.saveNewTheme = async function () {
    const name_display = document.getElementById("addNameDisplay").value.trim();
    const file_url = document.getElementById("addFileURL").value;

    if (!name_display) return alert("⚠️ Vui lòng nhập tên nhạc");
    if (!file_url) return alert("⚠️ Vui lòng tên file");

    const { error } = await supabase.from("music_list").insert({
      name_display,
      file_url,
    });

    if (error) {
      alert("❌ Thêm thất bại: " + error.message);
      return;
    }

    closeAddPopup();
    await loadDataFromTable();
  };

  window.closePopup = function () {
    document.getElementById("editPopupOverlay").style.display = "none";
  };
  window.closeAddPopup = function () {
    document.getElementById("addPopupOverlay").style.display = "none";
  };

  // =======================================
  // 📤 XUẤT EXCEL
  // =======================================
  window.exportToExcel = async function () {
    const currentTable = "music_list"; // 👈 cố định bảng

    const { data, error } = await supabase.from(currentTable).select("*");

    if (error) {
      alert("❌ Lỗi lấy dữ liệu: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      alert("⚠️ Không có dữ liệu để xuất.");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, currentTable);

    const fileName = `${currentTable}_export.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // =======================================
  // 📥 NHẬP EXCEL
  // =======================================
  window.importExcel = async function () {
    const currentTable = "music_list"; // 👈 cố định bảng

    const fileInput = document.getElementById("excelFile");
    if (!fileInput || !fileInput.files.length) {
      alert("Hãy chọn file Excel!");
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function (e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      // Lấy sheet đầu tiên
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert sheet → JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      console.log("Excel data:", jsonData);

      // Gửi dữ liệu lên Supabase
      const { data: inserted, error } = await supabase
        .from(currentTable)
        .insert(jsonData);

      if (error) {
        console.error("Import lỗi:", error);
        alert("❌ Có lỗi khi import!");
      } else {
        console.log("Đã import:", inserted);
        alert("✅ Import thành công!");
        // Gọi lại load nếu bạn có hàm load danh sách nhạc
        if (typeof loadDataFromTable === "function") {
          await loadDataFromTable(currentTable);
        }
      }
    };

    reader.readAsArrayBuffer(file);
  };
})();
