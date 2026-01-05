// Main Application Module
import Database from "./db.js";
import UI from "./ui.js";
import PDFExporter from "./pdf.js";

class App {
  constructor() {
    this.db = new Database();
    this.ui = new UI();
    this.pdfExporter = new PDFExporter();

    this.anggota = [];
    this.kelompokData = [];
    this.modeJumlah = true;
    this.isEditing = false;
    this.editingId = null;
  }

  // Initialize application
  async init() {
    try {
      await this.db.init();
      await this.loadAnggotaFromDB();
      await this.loadLatestKelompok();
      this.setupEventListeners();
      this.ui.updateAnggotaCount(this.anggota.length);
    } catch (error) {
      console.error("Failed to initialize app:", error);
      this.ui.showToast("Gagal menginisialisasi aplikasi", "error");
    }
  }

  // Load anggota from database
  async loadAnggotaFromDB() {
    try {
      this.anggota = await this.db.getAllAnggota();
      this.ui.renderTabelAnggota(this.anggota);
      this.ui.updateAnggotaCount(this.anggota.length);
    } catch (error) {
      console.error("Failed to load anggota:", error);
    }
  }

  // Load latest kelompok from database
  async loadLatestKelompok() {
    try {
      const latestKelompok = await this.db.getLatestKelompok();
      if (latestKelompok && latestKelompok.data) {
        this.kelompokData = latestKelompok.data;
        this.ui.renderKelompok(this.kelompokData, true); // Skip animation on load
      }
    } catch (error) {
      console.error("Failed to load latest kelompok:", error);
    }
  }

  // Setup event listeners
  setupEventListeners() {
    // Modal outside click
    document.getElementById("modalInput").addEventListener("click", (e) => {
      if (e.target.id === "modalInput") {
        this.ui.toggleModal();
      }
    });
  }

  // Toggle mode
  toggleMode() {
    this.modeJumlah = !this.modeJumlah;
    this.ui.updateModeLabel(this.modeJumlah);
  }

  // Toggle modal
  toggleModalInput() {
    this.ui.toggleModal();
  }

  // Simpan nama anggota
  async simpanNamaAnggota() {
    const input = this.ui.getInputValue();
    if (!input) {
      this.ui.showToast("Silakan masukkan nama anggota");
      return;
    }

    // Split by both comma and newline
    const names = input
      .split(/[,\n]/)
      .map((name) => name.trim())
      .filter((name) => name);

    if (names.length === 0) {
      this.ui.showToast("Silakan masukkan nama anggota yang valid");
      return;
    }

    try {
      if (this.isEditing) {
        // Update existing anggota
        await this.db.updateAnggota(this.editingId, names[0]);
        this.isEditing = false;
        this.editingId = null;
        this.ui.updateButtonText("Tambah");
      } else {
        // Add new anggota
        for (const name of names) {
          await this.db.addAnggota(name);
        }
      }

      this.ui.clearInput();
      await this.loadAnggotaFromDB();
    } catch (error) {
      console.error("Failed to save anggota:", error);
      this.ui.showToast("Gagal menyimpan data", "error");
    }
  }

  // Edit anggota
  async editAnggota(id) {
    const anggota = this.anggota.find((a) => a.id === id);
    if (!anggota) return;

    this.ui.setInputValue(anggota.nama);
    this.editingId = id;
    this.isEditing = true;
    this.ui.updateButtonText("Update");
    this.ui.elements.namaAnggotaInput.focus();
  }

  // Hapus anggota
  async hapusAnggota(id) {
    if (confirm("Apakah Anda yakin ingin menghapus anggota ini?")) {
      try {
        await this.db.deleteAnggota(id);

        if (this.isEditing && this.editingId === id) {
          this.isEditing = false;
          this.editingId = null;
          this.ui.updateButtonText("Tambah");
          this.ui.clearInput();
        }

        await this.loadAnggotaFromDB();
      } catch (error) {
        console.error("Failed to delete anggota:", error);
        this.ui.showToast("Gagal menghapus data", "error");
      }
    }
  }

  // Reset all data
  async resetData() {
    if (
      this.anggota.length === 0 ||
      confirm("Apakah Anda yakin ingin menghapus semua data anggota?")
    ) {
      try {
        await this.db.clearAllAnggota();
        await this.db.clearAllKelompok();
        this.anggota = [];
        this.kelompokData = [];
        this.ui.renderTabelAnggota([]);
        this.ui.clearInput();
        this.ui.renderKelompok([]);
        this.isEditing = false;
        this.editingId = null;
        this.ui.updateButtonText("Tambah");
        this.ui.updateAnggotaCount(0);
      } catch (error) {
        console.error("Failed to reset data:", error);
        this.ui.showToast("Gagal mereset data", "error");
      }
    }
  }

  // Shuffle array
  acakArray(arr) {
    return arr
      .map((a) => ({ sort: Math.random(), value: a }))
      .sort((a, b) => a.sort - b.sort)
      .map((a) => a.value);
  }

  // Buat kelompok
  async buatKelompok() {
    if (this.anggota.length === 0) {
      this.ui.showToast(
        "Tidak ada anggota. Silakan tambahkan anggota terlebih dahulu."
      );
      this.ui.toggleModal();
      return;
    }

    const val = this.ui.getJumlahInput();
    if (!val || val < 1) {
      this.ui.showToast("Jumlah harus lebih dari 0");
      return;
    }

    const shuffledAnggota = this.acakArray([...this.anggota]);
    let jumlahKelompok;
    let anggotaPerKelompok;

    if (this.modeJumlah) {
      jumlahKelompok = Math.min(val, this.anggota.length);
      anggotaPerKelompok = Math.ceil(this.anggota.length / jumlahKelompok);
    } else {
      anggotaPerKelompok = Math.min(val, this.anggota.length);
      jumlahKelompok = Math.ceil(this.anggota.length / anggotaPerKelompok);
    }

    this.kelompokData = Array.from({ length: jumlahKelompok }, () => []);

    shuffledAnggota.forEach((anggota, index) => {
      const groupIndex = index % jumlahKelompok;
      this.kelompokData[groupIndex].push(anggota);
    });

    this.ui.renderKelompok(this.kelompokData);
    this.ui.updateAnggotaCount(this.anggota.length);

    // Save to database
    try {
      await this.db.saveKelompok(this.kelompokData);
    } catch (error) {
      console.error("Failed to save kelompok:", error);
    }
  }

  // Drag and drop handlers
  onDragStart(event, anggotaIdx, groupIdx) {
    event.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ anggotaIdx, groupIdx })
    );
    event.currentTarget.classList.add("dragging");
  }

  onDrop(event, toGroupIdx) {
    event.preventDefault();
    event.currentTarget.classList.remove("bg-gray-200");

    const dragData = JSON.parse(event.dataTransfer.getData("text/plain"));
    const { anggotaIdx, groupIdx: fromGroupIdx } = dragData;

    if (fromGroupIdx === toGroupIdx) return;

    const [movedAnggota] = this.kelompokData[fromGroupIdx].splice(
      anggotaIdx,
      1
    );
    this.kelompokData[toGroupIdx].push(movedAnggota);

    // Re-render without animation for smooth drag experience
    this.ui.renderKelompok(this.kelompokData, true);

    // Save updated kelompok to database
    this.db.saveKelompok(this.kelompokData).catch((error) => {
      console.error("Failed to save kelompok after drag:", error);
    });
  }

  // Export PDF
  exportPDF() {
    this.pdfExporter.exportKelompok(this.kelompokData, this.anggota.length);
  }
}

// Initialize app when DOM is ready
let app;
window.addEventListener("DOMContentLoaded", async () => {
  app = new App();
  window.app = app; // Make app globally accessible for inline event handlers
  await app.init();
});

export default App;
