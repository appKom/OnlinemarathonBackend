#!/usr/bin/env node

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

mongoose.set("strictQuery", false);
const port = process.env.PORT || 5000;
const DBURL = process.env.DBURL;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const CLUB_ID = process.env.CLUB_ID;

const app = express();
const TokensModel = require("./TokenModel");
let reqCount = 0;

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost",
      "https://online-maraton.vercel.app",
    ],
    method: "GET",
  })
);

let tokens = {};
let stravadata = {};

app.get("/data", (req, res) => {
  res.send(stravadata);
});

const start = async () => {
  try {
    await mongoose.connect(DBURL);
    app.listen(port, async () => {
      console.log(`Port: ${port}`);
      setTokens(await getFromDB());

      refreshToken().then(getStrava()).then(startInterval());
    });
  } catch (e) {
    console.log(e.message);
  }
};

function setTokens(data) {
  tokens.access_token = data.access_token;
  tokens.refresh_token = data.refresh_token;
  tokens.expires_at = data.expires_at;
}

async function getFromDB() {
  try {
    let DBdata = await TokensModel.find().then((data) => data[0]);
    return DBdata;
  } catch (e) {
    console.log(e.message);
    return;
  }
}

async function saveToDB(data) {
  try {
    await TokensModel.deleteMany({});
    const newTokens = new TokensModel({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    });
    await newTokens.save();
  } catch (e) {
    console.log(e.message);
  }
}

function startInterval() {
  setInterval(async () => {
    try {
      await getStrava();
    } catch {
      console.log("Error getting strava info");
    }
    if (tokens.expires_at < Date.now() / 1000) {
      await refreshToken();
    } else {
    }
  }, 1000 * 60 * 2);
}

async function getStrava() {
  if (tokens.expires_at < Date.now() / 1000) {
    await refreshToken();
  }
  await fetch(
    "https://www.strava.com/api/v3/clubs/"+CLUB_ID+"/activities?access_token=" +
      tokens.access_token
  )
    .then((res) => res.json())
    .then((json) => {
      stravadata = formatStravaData(json);
    });
}

function formatStravaData(data) {
  let res = [];
  let indexes = {};

  console.log("Formatting data");
  try {
    data.forEach((d) => {
      // if d.name in lower case does not contain "online", skip
      if (!d.name.toLowerCase().includes("online")) {
        
      }
        else if (
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
  console.log("------------");
  console.log("       CURRENT TOKENS     ");
  console.log("Access Token: " + tokens.access_token);
  console.log("Refresh Token: " + tokens.refresh_token);
  console.log("Expires At: " + tokens.expires_at);
  console.log("------------");
}

async function refreshToken() {
  console.log(tokens.refresh_token);
  return await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  })
    .then((res) => res.json())
    .then((r) => {
      if (r.access_token) {
        tokens.access_token = r.access_token;
        tokens.refresh_token = r.refresh_token;
        tokens.expires_at = r.expires_at;
        saveToDB(tokens);
        logTokens();
      } else {
        console.log("FAILED TO REFRESH TOKENS");
        console.log("Current: " + JSON.stringify(tokens));
      }
      return tokens;
    });
}

start();
