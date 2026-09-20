type LoudnessBand = { min: number; color: string; label: string };
type CentroidBand = { max: number; color: string; label: string };

const LOUDNESS_BANDS: LoudnessBand[] = [
  { min: -6, color: "#111111", label: "Deafening" },
  { min: -9, color: "#5C5346", label: "Extremely Loud" },
  { min: -12, color: "#6B7000", label: "Very Loud" },
  { min: -18, color: "#0F766E", label: "Loud" },
  { min: -24, color: "#0E7490", label: "Moderate" },
  { min: -36, color: "#9D174D", label: "Quiet" },
  { min: -48, color: "#5B21B6", label: "Very Quiet" },
  { min: -60, color: "#1E40AF", label: "Barely Audible" },
  { min: Number.NEGATIVE_INFINITY, color: "#4B5563", label: "Silent" },
];

const CENTROID_BANDS: CentroidBand[] = [
  { max: 60, color: "#4B5563", label: "Rumbly" },
  { max: 250, color: "#1E40AF", label: "Deep" },
  { max: 500, color: "#5B21B6", label: "Warm" },
  { max: 1000, color: "#9D174D", label: "Full" },
  { max: 2000, color: "#0E7490", label: "Balanced" },
  { max: 4000, color: "#0F766E", label: "Clear" },
  { max: 8000, color: "#A16207", label: "Bright" },
  { max: 12000, color: "#57534E", label: "Sharp" },
  { max: Number.POSITIVE_INFINITY, color: "#111111", label: "Airy" },
];

const lastLoudnessBand = LOUDNESS_BANDS[LOUDNESS_BANDS.length - 1] ?? {
  min: Number.NEGATIVE_INFINITY,
  color: "#4B5563",
  label: "Silent",
};

const lastCentroidBand = CENTROID_BANDS[CENTROID_BANDS.length - 1] ?? {
  max: Number.POSITIVE_INFINITY,
  color: "#111111",
  label: "Airy",
};

const loudnessBand = (db: number) =>
  LOUDNESS_BANDS.find((band) => db >= band.min) ?? lastLoudnessBand;

const centroidBand = (hz: number) =>
  CENTROID_BANDS.find((band) => hz < band.max) ?? lastCentroidBand;

export const formatLoudnessDb = (db: number) => `${Math.round(db)} dB`;

export const loudnessDbColor = (db: number) => loudnessBand(db).color;

export const loudnessDbLabel = (db: number) => loudnessBand(db).label;

export const centroidHzColor = (hz: number) => centroidBand(hz).color;

export const centroidHzLabel = (hz: number) => centroidBand(hz).label;

export type MetricFilterOption = {
  id: number;
  name: string;
  value: number;
  color: string;
};

export const PITCH_FILTERS: MetricFilterOption[] = [
  { id: 0, name: "Any", value: 0, color: "" },
  ...CENTROID_BANDS.map((band, index) => ({
    id: index + 1,
    name: band.label,
    value: band.max,
    color: band.color,
  })),
];

export const DECIBEL_FILTERS: MetricFilterOption[] = [
  { id: 0, name: "Any", value: 0, color: "" },
  ...LOUDNESS_BANDS.map((band, index) => ({
    id: index + 1,
    name: band.label,
    value: band.min,
    color: band.color,
  })),
];

const centroidBandIndex = (hz: number) => {
  const index = CENTROID_BANDS.findIndex((band) => hz < band.max);
  return index < 0 ? CENTROID_BANDS.length - 1 : index;
};

const loudnessBandIndex = (db: number) => {
  const index = LOUDNESS_BANDS.findIndex((band) => db >= band.min);
  return index < 0 ? LOUDNESS_BANDS.length - 1 : index;
};

export const matchesPitchFilter = (hz: number, filterId: number) => {
  if (filterId === 0) {
    return true;
  }
  return centroidBandIndex(hz) + 1 === filterId;
};

export const matchesDecibelFilter = (db: number | null, filterId: number) => {
  if (filterId === 0) {
    return true;
  }
  if (db == null) {
    return true;
  }
  return loudnessBandIndex(db) + 1 === filterId;
};
