const express = require("express");
const https = require("https");
const http = require("http");
const url = require("url");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.static("public"));

// Function to fetch and handle redirects and resources
function fetchUrl(targetUrl, callback) {
  const parsedUrl = url.parse(targetUrl);
  const protocol = parsedUrl.protocol === "https:" ? https : http;

  const request = protocol.get(targetUrl, (response) => {
    if (response.statusCode === 301 || response.statusCode === 302) {
      const redirectUrl = response.headers.location;
      console.log(`Redirecting to: ${redirectUrl}`);
      fetchUrl(redirectUrl, callback); // Recursively follow the redirect
    } else if (response.statusCode === 200) {
      let data = "";

      response.on("data", (chunk) => {
        data += chunk;
      });

      response.on("end", () => {
        // Modify URLs for images, CSS, JS, etc.
        data = modifyUrlsInHtml(data, targetUrl);
        callback(null, data);
      });
    } else {
      callback(`Error: Received status code ${response.statusCode}`, null);
    }
  });

  request.on("error", (err) => {
    callback(`Request Error: ${err.message}`, null);
  });
}

// Modify URLs in the fetched HTML to ensure they are absolute URLs
function modifyUrlsInHtml(html, baseUrl) {
  // Modify image, CSS, and JS URLs to be absolute if they are relative
  return html.replace(/(src|href)=["']([^"']+)["']/g, (match, attribute, resourceUrl) => {
    // If the URL is relative, prepend the base URL
    if (resourceUrl && !resourceUrl.startsWith('http')) {
      const modifiedUrl = new URL(resourceUrl, baseUrl).href;
      return `${attribute}="${modifiedUrl}"`; // Return the modified URL
    }
    return match; // If it's already absolute, leave it as is
  });
}

// Handle the proxy request for the main page and resources like images
app.get("/proxy", (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send("Missing ?url=");
  }

  fetchUrl(targetUrl, (error, data) => {
    if (error) {
      return res.status(500).send(error);
    }
    res.send(data);
  });
});

// Handle static resources (images, CSS, JS) that may be requested
app.get("/resources/*", (req, res) => {
  const resourceUrl = req.params[0];
  const fullUrl = `http://${resourceUrl}`; // Construct the full URL for the resource
  const parsedUrl = url.parse(fullUrl);

  const protocol = parsedUrl.protocol === "https:" ? https : http;

  protocol.get(fullUrl, (response) => {
    const contentType = response.headers['content-type'];
    res.setHeader('Content-Type', contentType);
    response.pipe(res); // Pipe the response back to the client
  }).on('error', (err) => {
    res.status(500).send(`Error fetching resource: ${err.message}`);
  });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
