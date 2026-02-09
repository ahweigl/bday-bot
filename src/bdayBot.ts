import { WebClient } from "@slack/web-api";
import { google } from "googleapis";
import { DateTime } from "luxon";
import "dotenv/config";

type Person = {
    name: string;
    birthday: string;
}

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing environment variable: ${name}`);
    }
    return value;
}

const SLACK_BOT_TOKEN = requireEnv("SLACK_BOT_TOKEN");
const SLACK_CHANNEL_ID = requireEnv("SLACK_CHANNEL_ID");
const SPREADSHEET_ID = requireEnv("SPREADSHEET_ID");
const GOOGLE_SERVICE_ACCOUNT_JSON = requireEnv("GOOGLE_SERVICE_ACCOUNT_JSON");

const slack = new WebClient(SLACK_BOT_TOKEN);

function isMidnightET(): boolean {
    const nowET = DateTime.now().setZone("America/New_York");
    return nowET.hour === 0;
}

async function getBirthdays(): Promise<Person[]> {
    const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON),
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    });

    const sheets = google.sheets({ version: "v4", auth });

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Sheet1!A2:B"
    });

    const rows = res.data.values ?? [];

    return rows.filter((row): row is [string, string] => row.length >= 2).map(([name, birthday]) => ({
        name: String(name).trim(),
        birthday: String(birthday).trim()
    }));
}

function isBirthdayToday(birthday: string): boolean {
    const todayET = DateTime.now().setZone("America/New_York");
    const bday = DateTime.fromISO(birthday);

    return (
        todayET.month === bday.month
        && todayET.day === bday.day
    );
}

async function sendBirthdayMessage(name: string) {
    await slack.chat.postMessage({
        channel: SLACK_CHANNEL_ID,
        text: `:sharty: :party-blob: :minecraft-party-sheep: :partyge: :meow-love: *Happy Birthday, ${name}!* :party-blob: :partyge: :meow-love:`

    });
}

async function main() {
    if (!isMidnightET()) {
        return;
    }

    const birthdays = await getBirthdays();

    for (const person of birthdays) {
        if (isBirthdayToday(person.birthday)) {
            await sendBirthdayMessage(person.name);
        }
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});