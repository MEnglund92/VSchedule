const scheduleData = [
  { day: 1, dayName: "Måndag", time: "09:05–09:45", subject: "Klassmöte", category: "class-meeting", teacher: "ELKJ / BEMA" },
  { day: 1, dayName: "Måndag", time: "10:00–11:10", subject: "Geografi / Historia / Samhälle / Religion", category: "geo-hist", teacher: "ELKJ" },
  { day: 1, dayName: "Måndag", time: "11:50–12:45", subject: "Svenska", category: "swedish", teacher: "BEMA" },
  { day: 1, dayName: "Måndag", time: "12:45–13:35", subject: "Matematik", category: "maths", teacher: "PETE" },
  { day: 1, dayName: "Måndag", time: "13:35–14:30", subject: "Biologi / Kemi / Fysik", category: "science", teacher: "BEMA" },
  { day: 1, dayName: "Måndag", time: "16:15–17:30", subject: "Bild och form", category: "art", teacher: "GERY" },

  { day: 2, dayName: "Tisdag", time: "08:40–09:45", subject: "Svenska", category: "swedish", teacher: "BEMA" },
  { day: 2, dayName: "Tisdag", time: "09:45–10:45", subject: "Engelska", category: "english", teacher: "STNO" },
  { day: 2, dayName: "Tisdag", time: "11:35–12:35", subject: "Musik", category: "music", teacher: "PETE / DAHA" },
  { day: 2, dayName: "Tisdag", time: "12:50–13:50", subject: "Matematik", category: "maths", teacher: "PETE" },
  { day: 2, dayName: "Tisdag", time: "13:50–13:55", subject: "SVA", category: "sva", teacher: "KALI" },
  { day: 2, dayName: "Tisdag", time: "14:30–14:50", subject: "Elgitarr", category: "instrument", teacher: "" },
  { day: 2, dayName: "Tisdag", time: "15:00–15:20", subject: "Kontrabas", category: "instrument", teacher: "" },
  { day: 2, dayName: "Tisdag", time: "15:40–17:00", subject: "Percussion", category: "instrument", teacher: "" },

  { day: 3, dayName: "Onsdag", time: "08:00–08:50", subject: "Biologi / Kemi / Fysik", category: "science", teacher: "BEMA" },
  { day: 3, dayName: "Onsdag", time: "09:05–10:05", subject: "Geografi / Historia / Samhälle / Religion", category: "geo-hist", teacher: "ELKJ" },
  { day: 3, dayName: "Onsdag", time: "10:05–11:05", subject: "Matematik", category: "maths", teacher: "PETE" },
  { day: 3, dayName: "Onsdag", time: "11:45–12:50", subject: "Idrott och hälsa", category: "pe", teacher: "ALPA" },
  { day: 3, dayName: "Onsdag", time: "13:05–14:10", subject: "SVA / Laboration", category: "sva", teacher: "KALI" },
  { day: 3, dayName: "Onsdag", time: "15:00–15:30", subject: "Piano", category: "instrument", teacher: "" },
  { day: 3, dayName: "Onsdag", time: "15:45–17:00", subject: "Film", category: "art", teacher: "" },

  { day: 4, dayName: "Torsdag", time: "08:00–08:50", subject: "Engelska", category: "english", teacher: "STNO" },
  { day: 4, dayName: "Torsdag", time: "08:50–09:50", subject: "Bild", category: "art", teacher: "GERY" },
  { day: 4, dayName: "Torsdag", time: "09:50–10:35", subject: "Idrott och hälsa", category: "pe", teacher: "ALPA" },
  { day: 4, dayName: "Torsdag", time: "11:05–11:40", subject: "Gångvakt", category: "duty", teacher: "" },
  { day: 4, dayName: "Torsdag", time: "11:40–12:50", subject: "Slöjd / Textilt", category: "craft", teacher: "" },
  { day: 4, dayName: "Torsdag", time: "12:50–13:05", subject: "Studievakt", category: "duty", teacher: "" },
  { day: 4, dayName: "Torsdag", time: "13:05–14:05", subject: "SVA / Laboration", category: "sva", teacher: "KALI" },
  { day: 4, dayName: "Torsdag", time: "14:05–14:35", subject: "Hemkunskap", category: "home-ec", teacher: "JAYA" },
  { day: 4, dayName: "Torsdag", time: "15:45–16:45", subject: "Street dance", category: "dance", teacher: "" },
  { day: 4, dayName: "Torsdag", time: "16:45–17:00", subject: "Flute", category: "instrument", teacher: "" },
  { day: 4, dayName: "Torsdag", time: "18:00–18:40", subject: "Blåsorkester", category: "ensemble", teacher: "" },

  { day: 5, dayName: "Fredag", time: "08:05–09:05", subject: "Matematik", category: "maths", teacher: "PETE" },
  { day: 5, dayName: "Fredag", time: "09:05–10:15", subject: "Engelska", category: "english", teacher: "STNO" },
  { day: 5, dayName: "Fredag", time: "10:35–11:30", subject: "SVA", category: "sva", teacher: "KALI" },
  { day: 5, dayName: "Fredag", time: "11:50–12:10", subject: "Svenska", category: "swedish", teacher: "BEMA" },
  { day: 5, dayName: "Fredag", time: "12:10–13:10", subject: "Teknik", category: "tech", teacher: "BEMA" },
  { day: 5, dayName: "Fredag", time: "13:10–14:15", subject: "Geografi / Historia / Samhälle / Religion", category: "geo-hist", teacher: "ELKJ" }
];

const categoryColors = {
  "class-meeting": "#2563eb",
  "geo-hist": "#16a34a",
  "swedish": "#dc2626",
  "maths": "#9333ea",
  "science": "#ea580c",
  "art": "#0891b2",
  "english": "#db2777",
  "music": "#7c3aed",
  "sva": "#65a30d",
  "instrument": "#f97316",
  "pe": "#ef4444",
  "duty": "#64748b",
  "craft": "#84cc16",
  "home-ec": "#f43f5e",
  "dance": "#d946ef",
  "ensemble": "#3b82f6",
  "tech": "#8b5cf6"
};

const categoryLabels = {
  "class-meeting": "Klassmöte",
  "geo-hist": "Geografi/Historia/Samhälle/Religion",
  "swedish": "Svenska",
  "maths": "Matematik",
  "science": "Biologi/Kemi/Fysik",
  "art": "Bild och form",
  "english": "Engelska",
  "music": "Musik",
  "sva": "SVA",
  "instrument": "Instrument",
  "pe": "Idrott",
  "duty": "Vakt",
  "craft": "Slöjd/Textilt",
  "home-ec": "Hemkunskap",
  "dance": "Dans",
  "ensemble": "Ensemble",
  "tech": "Teknik"
};

const days = [
  { index: 1, name: "Mån", fullName: "Måndag" },
  { index: 2, name: "Tis", fullName: "Tisdag" },
  { index: 3, name: "Ons", fullName: "Onsdag" },
  { index: 4, name: "Tor", fullName: "Torsdag" },
  { index: 5, name: "Fre", fullName: "Fredag" }
];

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function parseTimeRange(range) {
  const [start, end] = range.split("–").map(s => s.trim());
  return { start: timeToMinutes(start), end: timeToMinutes(end) };
}

function getScheduleForDay(dayIndex) {
  return scheduleData.filter(item => item.day === dayIndex);
}

function getAllCategories() {
  const cats = new Set();
  scheduleData.forEach(item => cats.add(item.category));
  return Array.from(cats).map(cat => ({
    key: cat,
    label: categoryLabels[cat] || cat,
    color: categoryColors[cat] || "#64748b"
  }));
}