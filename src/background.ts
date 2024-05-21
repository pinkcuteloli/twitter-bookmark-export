let isSyncing = false;
let bookmarks: any[] = [];
let authTokens: { [key: string]: string } = {};
let bookmarksPageURL: string | null = null;
let activeTab: chrome.tabs.Tab | null = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "start_download") {
        if (sender.tab && sender.tab.url?.includes("i/bookmarks")) {
            activeTab = sender.tab;
            startSync();
        }
    } else if (message.action === "fetch_page") {
        let entries = getEntriesFromPage(message.page);

        bookmarks = bookmarks.concat(entries);
        chrome.action.setBadgeText({ text: bookmarks.length.toString() });
    } else if (message.action === "finish_download") {
        finishSync();
    } else if (message.action === "abort") {
        abortSync();
    }
    return true;
});

chrome.action.onClicked.addListener(() => {
    if (isSyncing) {
        if (activeTab) {
            chrome.tabs.sendMessage(activeTab.id!, { action: "abortConfirm" });
        }
        return;
    }
    if (Object.keys(authTokens).length === 2 && bookmarksPageURL && activeTab) {
        console.log("Starting sync...");
        startSync();
    } else {
        console.log("Opening bookmarks page...");
        chrome.tabs.create({ url: "https://x.com/i/bookmarks" }, (tab) => {
            activeTab = tab;

            let interval = setInterval(() => {
                console.log("bookmarksPageURL: ", bookmarksPageURL);
                console.log("authTokens: ", authTokens);
                console.log("Object.keys(authTokens).length: ", Object.keys(authTokens).length);

                if (Object.keys(authTokens).length === 2 && bookmarksPageURL) {

                    console.log("Starting sync... 2");
                    startSync();
                    clearInterval(interval);
                } else {
                    console.log("Waiting for auth tokens...");
                }
            }, 500);
        });
    }
});

chrome.webRequest.onBeforeSendHeaders.addListener((details) => {
    if (details.requestHeaders) {
        for (let header of details.requestHeaders) {
            if (header.name === "x-csrf-token" && header.value) {
                authTokens["x-csrf-token"] = header.value;
            } else if (header.name === "authorization" && header.value) {
                authTokens.authorization = header.value;
                console.log("Authorization: ", authTokens);
            }
        }
    }
    return { requestHeaders: details.requestHeaders };
}, { urls: ["*://x.com/*"] }, ["requestHeaders"]);

chrome.webRequest.onBeforeRequest.addListener((details) => {

    if (details.url.includes("Bookmarks")) {

        bookmarksPageURL = details.url;

        console.log("bookmarksPageURL: ", bookmarksPageURL);
    } else if (details.url.includes("BookmarkFoldersSlice") && activeTab) {
        chrome.tabs.sendMessage(activeTab.id!, { action: "selectAllBookmarks" });
    }
}, { urls: ["https://*.x.com/*"] },
);

function getEntriesFromPage(page: any): any[] {
    let entries = page.data.bookmark_timeline_v2.timeline.instructions[0].entries || [];
    return entries.length >= 2 ? entries.slice(0, entries.length - 2) : [];
}

function startSync() {
    isSyncing = true;
    bookmarks = [];
    if (activeTab) {
        chrome.tabs.sendMessage(activeTab.id!, {
            action: "iconClicked",
            creds: authTokens,
            bookmarksURL: bookmarksPageURL
        });
    }
}

function finishSync() {
    isSyncing = false;
    chrome.action.setBadgeText({ text: "" });
    let syncTime = new Date();
    chrome.storage.local.set({
        bookmarks: JSON.stringify(bookmarks),
        sync_at: syncTime.getTime()
    }).then(() => {
        if (activeTab) {
            chrome.tabs.remove(activeTab.id!);
        }
        activeTab = null;
        chrome.tabs.create({ url: chrome.runtime.getURL("download.html") });
    });
}

function abortSync() {
    isSyncing = false;
    chrome.action.setBadgeText({ text: "" });
    let syncTime = new Date();
    chrome.storage.local.set({
        bookmarks: JSON.stringify(bookmarks),
        sync_at: syncTime.getTime()
    }).then(() => {
        chrome.tabs.create({ url: chrome.runtime.getURL("download.html") });
    });
    activeTab = null;
}

