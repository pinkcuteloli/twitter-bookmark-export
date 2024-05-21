(() => {
    function delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function createOverlay() {
        const overlay = document.createElement("div");
        Object.assign(overlay.style, {
            position: "fixed",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            zIndex: "10000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column"
        });

        const spinner = document.createElement("div");
        spinner.className = "spinner";
        overlay.appendChild(spinner);

        const messageElement = document.createElement("h1");
        messageElement.textContent = "Bookmarks are downloading. Please wait...";
        Object.assign(messageElement.style, {
            color: "white",
            marginTop: "20px",
            fontSize: "16px"
        });
        overlay.appendChild(messageElement);

        const stopButton = document.createElement("button");
        stopButton.textContent = "Stop Download";
        Object.assign(stopButton.style, {
            marginTop: "20px",
            padding: "10px 20px",
            fontSize: "16px",
            cursor: "pointer",
            backgroundColor: "#f44336",
            border: "none",
            color: "white",
            borderRadius: "5px"
        });
        stopButton.onclick = function () {
            chrome.runtime.sendMessage({ action: "abort" });
            document.body.removeChild(overlay);
        };
        overlay.appendChild(stopButton);

        document.body.appendChild(overlay);
        return overlay;
    }

    chrome.runtime.onMessage.addListener(async function (message) {
        if (message.action === "iconClicked") {
            const baseURL = message.bookmarksURL.split("?")[0];
            const queryParams = new URLSearchParams(message.bookmarksURL.split("?")[1]);
            let cursor = null;

            const overlay = createOverlay();

            while (true) {
                const page = await fetchPage(cursor, message.creds, baseURL, queryParams);
                cursor = getCursorFromResponse(page);
                chrome.runtime.sendMessage({ action: "fetch_page", page });

                if (isLastPage(page)) break;
                await delay(5000);
            }

            chrome.runtime.sendMessage({ action: "finish_download" });
            setTimeout(() => { document.body.removeChild(overlay); }, 1000);
        }
    });

    async function fetchPage(cursor: string | null, creds: any, baseURL: string, queryParams: URLSearchParams) {
        const params = { count: 50, includePromotedContent: true, cursor: cursor };
        queryParams.set("variables", JSON.stringify(params));
        const url = `${baseURL}?${queryParams.toString()}`;

        return fetch(url, {
            headers: {
                "accept": "*/*",
                "accept-language": "en-US,en;q=0.9,zh-TW;q=0.8,zh;q=0.7",
                "authorization": creds.authorization,
                "cache-control": "no-cache",
                "content-type": "application/json",
                "pragma": "no-cache",
                "sec-ch-ua": '"Chromium";v="112", "Google Chrome";v="112", "Not:A-Brand";v="99"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"macOS"',
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "sec-gpc": "1",
                "x-csrf-token": creds["x-csrf-token"],
                "x-twitter-active-user": "yes",
                "x-twitter-auth-type": "OAuth2Session",
                "x-twitter-client-language": "ja"
            },
            referrer: "https://x.com/i/bookmarks",
            referrerPolicy: "strict-origin-when-cross-origin",
            method: "GET",
            mode: "cors",
            credentials: "include"
        }).then(response => response.json());
    }

    function getCursorFromResponse(response: any) {
        const entries = response.data.bookmark_timeline_v2.timeline.instructions[0].entries;
        return entries[entries.length - 1].content.value;
    }

    function isLastPage(response: any) {
        return response.data.bookmark_timeline_v2.timeline.instructions[0].entries.length <= 2;
    }
})();
