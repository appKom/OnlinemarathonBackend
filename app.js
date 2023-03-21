try {
  // Trengs på localhost, fungerer ikke på server (render)
  require("dotenv").config();
} catch {}
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

let stravadata;
let data = {};

function startInterval() {
  setInterval(async () => {
    try {
      await getStrava();
    } catch {
      console.log("Error getting strava info");
    }
    if (data.expires_at < Date.now() / 1000) {
      await refreshToken().then();
    } else {
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
  console.log(data);
  try {
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
  } catch {
    console.log(data);
  }
  return res;
}

function logTokens() {
  console.log("Access Token: " + data.access_token);
  console.log("Refresh Token: " + data.refresh_token);
  console.log("Expires At: " + data.expires_at);
  console.log("------------");
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
      if (r.access_token) {
        data.access_token = r.access_token;
        data.refresh_token = r.refresh_token;
        data.expires_at = r.expires_at;
        console.log("REFRESHED TOKENS");
        logTokens();
      } else {
        console.log("FAILED TO REFRESH TOKENS");
      }

      return data;
    });
}

app.get("/", (req, res) => {
  res.send(stravadata);
});

app.listen(port, () => {
  data.access_token = process.env.ACCESS_TOKEN;
  data.refresh_token = process.env.REFRESH_TOKEN;
  data.expires_at = process.env.EXPIRES_AT;
  data.client_secret = process.env.CLIENT_SECRET;
  data.client_id = process.env.CLIENT_ID;

  refreshToken().then(getStrava()).then(startInterval());

  console.log(`Port: ${port}`);

  logTokens();
});
