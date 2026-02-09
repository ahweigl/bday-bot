import { WebClient } from "@slack/web-api";
import { google } from "googleapis";
import { DateTime } from "luxon";
import "dotenv/config";

type Person = {
    name: string;
    birthday: string;
};

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing environment variable: ${name}`);
    }
    return value;
}

console.log("Validating environment variables...");

const FORCE_RUN = process.env.FORCE_RUN === "true";
const SLACK_BOT_TOKEN = requireEnv("SLACK_BOT_TOKEN");
const SLACK_CHANNEL_ID = requireEnv("SLACK_CHANNEL_ID");
const SPREADSHEET_ID = requireEnv("SPREADSHEET_ID");
const GOOGLE_SERVICE_ACCOUNT_JSON = requireEnv("GOOGLE_SERVICE_ACCOUNT_JSON");

console.log("Environment variables loaded");

const slack = new WebClient(SLACK_BOT_TOKEN);

function isMidnightET(): boolean {
    const nowET = DateTime.now().setZone("America/New_York");
    console.log(`Current ET time: ${nowET.toFormat("HH:mm:ss")}`);
    return nowET.hour === 0;
}

async function getBirthdays(): Promise<Person[]> {
    console.log("Connecting to Google Sheets...");

    const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON),
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Sheet1!A2:B",
    });

    const rows = res.data.values ?? [];

    const people = rows
        .filter((row): row is [string, string] => row.length >= 2)
        .map(([name, birthday]) => ({
            name: String(name).trim(),
            birthday: String(birthday).trim(),
        }));

    console.log("Parsed people:", people);

    return people;
}

function isBirthdayToday(birthday: string): boolean {
    const todayET = DateTime.now().setZone("America/New_York");
    const bday = DateTime.fromISO(birthday);

    if (!bday.isValid) {
        console.warn(`Invalid birthday format: ${birthday}`);
        return false;
    }

    return todayET.month === bday.month && todayET.day === bday.day;
}

async function sendBirthdayMessage(name: string) {
    console.log(`Sending bday message for ${name}`);

    await slack.chat.postMessage({
        channel: SLACK_CHANNEL_ID,
        text: `:sharty: :party-blob: :minecraft-party-sheep: :partyge: :meow_love: *Happy Birthday, ${name}!* :sharty: :party-blob: :partyge: :meow_love:`,
    });

    console.log(`Message sent for ${name}`);
}

async function main() {
    console.log("Bday bot starting...");

    if (!FORCE_RUN && !isMidnightET()) {
        console.log("Not midnight ET, exiting...");
        return;
    }

    if (FORCE_RUN) {
        console.log("Forcing run for testing...");
    }

    console.log("Checking birthdays!");

    const birthdays = await getBirthdays();

    if (birthdays.length === 0) {
        console.log("No birthdays found");
        return;
    }

    for (const person of birthdays) {
        if (isBirthdayToday(person.birthday)) {
            await sendBirthdayMessage(person.name);
        }
    }

    console.log("Bday bot finished!");
}

main().catch((err) => {
    console.error("Oof, error:", err);
    process.exit(1);
});
