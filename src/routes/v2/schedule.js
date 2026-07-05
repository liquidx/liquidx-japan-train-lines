// Synthetic weekday timetable engine.
//
// Until real timetable data (e.g. ODPT odpt:TrainTimetable) is wired in,
// trains run on a deterministic headway-based schedule: departures from each
// terminus between 05:00 and 24:30, headway varying by time of day, constant
// average speed. The interface — trainsAt(model, clockSeconds) — is designed
// so a real timetable can replace this without touching the renderer.

export const SERVICE_START = 5 * 3600;
export const SERVICE_END = 24.5 * 3600;

// Average speed including dwell time, m/s (~33 km/h).
const AVG_SPEED = 9.2;

// Headway in seconds at a given clock time.
export const headwayAt = (clockSec) => {
  const h = clockSec / 3600;
  if (h < 6) return 420;
  if (h < 7) return 240;
  if (h < 9.5) return 150; // morning rush
  if (h < 17) return 300;
  if (h < 20) return 180; // evening rush
  if (h < 22) return 300;
  return 420;
};

// Precompute the day's departure times (shared by all lines/directions).
let _departures = null;
const departures = () => {
  if (_departures) return _departures;
  const out = [];
  let t = SERVICE_START;
  while (t <= SERVICE_END) {
    out.push(t);
    t += headwayAt(t);
  }
  _departures = out;
  return out;
};

// All active trains on a line model at a clock time.
// Calls visit(s, dir) with arc position s (meters along the main path)
// for each active train.
export const trainsAt = (model, clockSec, visit) => {
  const path = model.paths[model.mainPath];
  const duration = path.total / AVG_SPEED;
  const deps = departures();
  let count = 0;
  for (const dep of deps) {
    if (dep > clockSec) break;
    if (clockSec - dep >= duration) continue;
    const s = (clockSec - dep) * AVG_SPEED;
    visit(s, 0);
    visit(path.total - s, 1);
    count += 2;
  }
  return count;
};

// Upper bound of simultaneous trains on a line (for buffer allocation).
export const maxTrains = (model) => {
  const path = model.paths[model.mainPath];
  const duration = path.total / AVG_SPEED;
  return 2 * (Math.ceil(duration / 150) + 2);
};

export const formatClock = (clockSec) => {
  const h = Math.floor(clockSec / 3600);
  const m = Math.floor((clockSec % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
