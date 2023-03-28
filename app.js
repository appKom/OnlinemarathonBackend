try {
  // Trengs på localhost, fungerer ikke på server (render)
  require("dotenv").config();
} catch {}
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const filename = "./token.json";

const app = express();
app.use(
  cors({
    origin: "http://localhost:3000",
  })
);
const port = process.env.PORT || 5000;
let lastFetched;

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
      await refreshToken();
    } else {
    }
  }, 1000 * 60 * 2);
}

async function getStrava() {
  if (data.expires_at < Date.now() / 1000) {
    await refreshToken();
  }
  await fetch(
    "https://www.strava.com/api/v3/clubs/1118846/activities?access_token=" +
      data.access_token
  )
    .then((res) => res.json())
    .then((json) => {
      stravadata = formatStravaData(json);
      lastFetched = Date.now();
    });
}

function formatStravaData(data) {
  let res = [];
  let indexes = {};
  console.log("Formatting data");
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
    console.log("Error");
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
        saveToFile(data);
        logTokens();
      } else {
        console.log("FAILED TO REFRESH TOKENS");
        console.log("Current: " + data);
      }

      return data;
    });
}

async function saveToFile(data) {
  fs.writeFile(filename, JSON.stringify(data), (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log("Saved to file");
    }
  });
}

app.get("/data", (req, res) => {
  if (Date.now() - lastFetched > 1000 * 60 * 2) {
    getStrava().then(() => {
      res.send(stravadata);
    });
  } else {
    res.send(stravadata);
  }
});

app.listen(port, () => {
  fs.readFile(filename, "utf8", async (err, result) => {
    if (err) {
      console.error(err);
      return;
    }
    lastFetched = 0;

    result = JSON.parse(result);
    console.log("\n\nResult from file:");
    console.log(result);
    console.log("-----------");
    if (result.access_token) {
      console.log("-----------\nGot secrets from file: ");
      console.log(result);
      console.log("-----------");
      data.access_token = result.access_token;
      data.refresh_token = result.refresh_token;
      data.expires_at = result.expires_at;
      data.client_secret = result.client_secret;
      data.client_id = result.client_id;
    } else {
      console.log("--------\nGot secrets from env: ");

      console.log("Access:" + process.env.ACCESS_TOKEN);
      console.log("Refresh: " + process.env.REFRESH_TOKEN);
      console.log("Exp at:" + process.env.EXPIRES_AT);
      console.log("Client id: " + process.env.CLIENT_ID);
      console.log("Client secret" + process.env.CLIENT_SECRET);
      console.log("-----------");
      data.access_token = process.env.ACCESS_TOKEN;
      data.refresh_token = process.env.REFRESH_TOKEN;
      data.expires_at = process.env.EXPIRES_AT;
      data.client_secret = process.env.CLIENT_SECRET;
      data.client_id = process.env.CLIENT_ID;
    }

    saveToFile(data).then(
      refreshToken().then(getStrava()).then(startInterval())
    );
  });

  console.log(`Port: ${port}`);
});
