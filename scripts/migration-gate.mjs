import http from "node:http";

// Deliberately does not import the application, database, seeder or workers.
http.createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>U-Storage Go migration setup</title><body style="font-family:system-ui;padding:32px;max-width:700px;margin:auto">
  <h1>Migration setup is paused safely</h1><p>The website code is imported, but the application has not started.
  No database seeding or background jobs have been launched by this setup page.</p>
  <p>Read <strong>START_HERE.md</strong>, restore and verify the database in this new project's development environment,
  and review outgoing services before starting the application. Do not move the domain yet.</p></body></html>`);
}).listen(Number(process.env.PORT || 5000), "0.0.0.0", () => console.log("Migration safety gate running on port 5000."));
