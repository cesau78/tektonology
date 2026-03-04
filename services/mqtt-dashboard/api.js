import { Router } from "express";

const RANGE_MS = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

const DEFAULT_MAX_POINTS = 300;

// Bambu sends fan speeds and wifi_signal as strings — convert to numbers.
// wifi_signal is "-62dBm" so we parse just the numeric portion.
function toNum(field) {
  return { $toDouble: { $ifNull: [field, null] } };
}

function parseWifi(field) {
  return {
    $toDouble: {
      $replaceAll: { input: { $ifNull: [field, null] }, find: "dBm", replacement: "" },
    },
  };
}

function buildPipeline(from, to, maxPoints) {
  const match = {
    $match: {
      timestamp: { $gte: from, $lte: to },
      "meta.sender": "printer",
      "meta.topic.channel": "report",
      "payload.print": { $exists: true },
      $or: [
        { "payload.print.nozzle_temper": { $exists: true } },
        { "payload.print.bed_temper": { $exists: true } },
        { "payload.print.mc_percent": { $exists: true } },
      ],
    },
  };

  // Convert string fields to numbers before aggregation
  const addFields = {
    $addFields: {
      "_fan_cooling": toNum("$payload.print.cooling_fan_speed"),
      "_fan_big1": toNum("$payload.print.big_fan1_speed"),
      "_fan_big2": toNum("$payload.print.big_fan2_speed"),
      "_fan_heatbreak": toNum("$payload.print.heatbreak_fan_speed"),
      "_wifi": parseWifi("$payload.print.wifi_signal"),
    },
  };

  const sort = { $sort: { timestamp: 1 } };

  const projectFields = {
    _id: 0,
    timestamp: 1,
    nozzleTemper: 1,
    nozzleTargetTemper: 1,
    bedTemper: 1,
    bedTargetTemper: 1,
    mcPercent: 1,
    layerNum: 1,
    totalLayerNum: 1,
    gcodeState: 1,
    subtaskName: 1,
    coolingFanSpeed: 1,
    bigFan1Speed: 1,
    bigFan2Speed: 1,
    heatbreakFanSpeed: 1,
    spdLvl: 1,
    spdMag: 1,
    wifiSignal: 1,
    mcRemainingTime: 1,
    chamberTemper: 1,
  };

  // Skip downsampling if maxPoints is large enough
  if (maxPoints >= 10000) {
    return [
      match,
      addFields,
      {
        $project: {
          ...projectFields,
          nozzleTemper: "$payload.print.nozzle_temper",
          nozzleTargetTemper: "$payload.print.nozzle_target_temper",
          bedTemper: "$payload.print.bed_temper",
          bedTargetTemper: "$payload.print.bed_target_temper",
          mcPercent: "$payload.print.mc_percent",
          layerNum: "$payload.print.layer_num",
          totalLayerNum: "$payload.print.total_layer_num",
          gcodeState: "$payload.print.gcode_state",
          subtaskName: "$payload.print.subtask_name",
          coolingFanSpeed: "$_fan_cooling",
          bigFan1Speed: "$_fan_big1",
          bigFan2Speed: "$_fan_big2",
          heatbreakFanSpeed: "$_fan_heatbreak",
          spdLvl: "$payload.print.spd_lvl",
          spdMag: "$payload.print.spd_mag",
          wifiSignal: "$_wifi",
          mcRemainingTime: "$payload.print.mc_remaining_time",
          chamberTemper: "$payload.print.chamber_temper",
        },
      },
      sort,
    ];
  }

  return [
    match,
    addFields,
    {
      $bucketAuto: {
        groupBy: "$timestamp",
        buckets: maxPoints,
        output: {
          timestamp: { $first: "$timestamp" },
          nozzleTemper: { $avg: "$payload.print.nozzle_temper" },
          nozzleTargetTemper: { $last: "$payload.print.nozzle_target_temper" },
          bedTemper: { $avg: "$payload.print.bed_temper" },
          bedTargetTemper: { $last: "$payload.print.bed_target_temper" },
          mcPercent: { $last: "$payload.print.mc_percent" },
          layerNum: { $last: "$payload.print.layer_num" },
          totalLayerNum: { $last: "$payload.print.total_layer_num" },
          gcodeState: { $last: "$payload.print.gcode_state" },
          subtaskName: { $last: "$payload.print.subtask_name" },
          coolingFanSpeed: { $avg: "$_fan_cooling" },
          bigFan1Speed: { $avg: "$_fan_big1" },
          bigFan2Speed: { $avg: "$_fan_big2" },
          heatbreakFanSpeed: { $avg: "$_fan_heatbreak" },
          spdLvl: { $last: "$payload.print.spd_lvl" },
          spdMag: { $last: "$payload.print.spd_mag" },
          wifiSignal: { $avg: "$_wifi" },
          mcRemainingTime: { $last: "$payload.print.mc_remaining_time" },
          chamberTemper: { $avg: "$payload.print.chamber_temper" },
        },
      },
    },
    {
      $project: {
        ...projectFields,
        nozzleTemper: { $round: ["$nozzleTemper", 1] },
        bedTemper: { $round: ["$bedTemper", 1] },
        coolingFanSpeed: { $round: ["$coolingFanSpeed", 0] },
        bigFan1Speed: { $round: ["$bigFan1Speed", 0] },
        bigFan2Speed: { $round: ["$bigFan2Speed", 0] },
        heatbreakFanSpeed: { $round: ["$heatbreakFanSpeed", 0] },
        wifiSignal: { $round: ["$wifiSignal", 0] },
        chamberTemper: { $round: ["$chamberTemper", 1] },
      },
    },
    sort,
  ];
}

export function createTelemetryRouter(mqttLog) {
  const router = Router();

  router.get("/telemetry", async (req, res) => {
    try {
      const { range = "1h", from: fromStr, to: toStr, downsample } = req.query;
      const now = new Date();
      const to = toStr ? new Date(toStr) : now;
      const from = fromStr
        ? new Date(fromStr)
        : new Date(to.getTime() - (RANGE_MS[range] ?? RANGE_MS["1h"]));
      const maxPoints =
        downsample === "none" ? 10000 : parseInt(downsample, 10) || DEFAULT_MAX_POINTS;

      const pipeline = buildPipeline(from, to, maxPoints);
      const points = await mqttLog.aggregate(pipeline).toArray();

      res.json({ points, meta: { from, to, count: points.length } });
    } catch (err) {
      console.error("[api] telemetry error:", err.message);
      res.status(500).json({ error: "Query failed" });
    }
  });

  return router;
}
