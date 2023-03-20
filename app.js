const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const express = require("express");
const fs = require("fs");
const app = express();
const port = process.env.PORT || 3000;
const fileName = "./token.json";

let stravadata;
let data;

function startInterval() {
  setInterval(async () => {
    if (data.expires_at < Date.now() / 1000) {
      await refreshToken().then(await getStrava());
    }
  }, 1000 * 60 * 5);
}

async function getStrava() {
  await fetch(
    "https://www.strava.com/api/v3/clubs/1118846/activities?access_token=" +
      data.access_token
  )
    .then((res) => res.json())
    .then((json) => {
      stravadata = formatStravaData(json);
    });
}

function formatStravaData(data) {
  let res = [];
  let indexes = {};
  data.forEach((d) => {
    if (
      Object.keys(indexes).includes(
        d.athlete.firstname + " " + d.athlete.lastname
      )
    ) {
      res[indexes[d.athlete.firstname + " " + d.athlete.lastname]].total +=
        Math.round(Number(d.distance));
    } else {
      indexes[d.athlete.firstname + " " + d.athlete.lastname] = res.length;
      let athlete = {
        firstname: d.athlete.firstname,
        lastname: d.athlete.lastname,
        total: 0,
      };
      res.push(athlete);
      res[indexes[d.athlete.firstname + " " + d.athlete.lastname]].total =
        Math.round(Number(d.distance));
    }
  });
  return res;
}

async function refreshToken() {
  return await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: data.client_id,
      client_secret: data.client_secret,
      refresh_token: data.refresh_token,
      grant_type: "refresh_token",
    }),
  })
    .then((res) => res.json())
    .then((r) => {
      console.log(r);
      if (r.access_token) {
        data.access_token = r.access_token;
        data.refresh_token = r.refresh_token;
        data.expires_at = r.expires_at;
      }
      fs.writeFile(fileName, JSON.stringify(data), (err) => {
        if (err) {
          console.error(err);
        }
        console.log("wrote to file");
      });
      return data;
    });
}

app.get("/", (req, res) => {
  res.send(stravadata);
});

app.listen(port, () => {
  fs.readFile(fileName, "utf8", async (err, jsonString) => {
    if (err) {
      console.log("File read failed:", err);
      return;
    }

    data = JSON.parse(jsonString);
    await refreshToken();
    await getStrava();
    startInterval();
  });
});
