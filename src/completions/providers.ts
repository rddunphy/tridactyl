import * as config from "@src/lib/config"
import { browserBg } from "@src/lib/webext"

export function newtaburl() {
    // In the nonewtab version, this will return `null` and upset getURL.
    // Ternary op below prevents the runtime error.
    const newtab = browser.runtime.getManifest().chrome_url_overrides.newtab
    return newtab !== null ? browser.runtime.getURL(newtab) : null
}

export async function getBookmarks(query: string) {
    // Search bookmarks, dedupe and sort by most recent.
    let bookmarks = await browserBg.bookmarks.search({ query })

    // Remove folder nodes and bad URLs
    bookmarks = bookmarks.filter(b => {
        try {
            return new URL(b.url)
        } catch (e) {
            return false
        }
    })

    bookmarks.sort((a, b) => b.dateAdded - a.dateAdded)

    // Remove duplicate bookmarks
    const seen = new Map<string, string>()
    bookmarks = bookmarks.filter(b => {
        if (seen.get(b.title) === b.url) return false
        else {
            seen.set(b.title, b.url)
            return true
        }
    })

    return bookmarks
}

export async function getSearchUrls(query: string) {
    const suconf = config.get("searchurls")
    const searchScore = config.get("searchurlweight")

    const searchUrls = []
    for (const prop in suconf) {
        if (
            Object.prototype.hasOwnProperty.call(suconf, prop) &&
            prop.startsWith(query)
        ) {
            const url = suconf[prop]
            const url_parts = url.split("%s").join(" ")
            const history = await browserBg.history.search({
                text: url_parts,
                startTime: 0,
            })
            searchUrls.push({
                title: prop,
                url: suconf[prop],
                score: searchScore + history.length,
            })
        }
    }
    // Sort urls with equal score alphabetically
    searchUrls.sort((a, b) => (a.title > b.title ? 1 : -1))
    searchUrls.sort((a, b) => b.score - a.score)
    return searchUrls
}

async function frecency(item: browser.history.HistoryItem) {
    const halflife = config.get("frecencyhalflife")
    if (halflife <= 0) {
        return item.visitCount
    }
    const lambda = -Math.log(2) / (halflife * 86400000)
    const visits = await browserBg.history.getVisits({ url: item.url })
    const now = Date.now()
    const visitScores = visits.map(v => Math.exp(lambda * (now - v.visitTime)))
    return 2 * visitScores.reduce((a, b) => a + b, 0)
}

export async function getHistory(
    query: string,
): Promise<Array<{ title: string; url: string; score: number }>> {
    // Search history, dedupe and sort by frecency
    let history = await browserBg.history.search({
        text: query,
        maxResults: config.get("historyresults"),
        startTime: 0,
    })

    // Remove entries with duplicate URLs
    const dedupe = new Map()
    for (const page of history) {
        if (page.url !== newtaburl()) {
            if (dedupe.has(page.url)) {
                if (dedupe.get(page.url).title.length < page.title.length) {
                    dedupe.set(page.url, page)
                }
            } else {
                dedupe.set(page.url, page)
            }
        }
    }
    history = [...dedupe.values()]

    const history_entries = await Promise.all(
        history.map(async h => ({
            title: h.title,
            url: h.url,
            score: await frecency(h),
        })),
    )

    history_entries.sort((a, b) => b.score - a.score)

    return history_entries
}

export async function getTopSites(nSearchUrls = 0) {
    const searchUrls = (await getSearchUrls("")).slice(0, nSearchUrls)
    const combinedArray = searchUrls.map(su => ({
        title: su.title,
        url: su.url,
        search: true,
        score: su.score,
    }))
    const topsites = (await browserBg.topSites.get()).filter(
        page => page.url !== newtaburl(),
    )
    topsites.forEach(site => {
        combinedArray.push({
            title: site.title,
            url: site.url,
            search: false,
            score: 0,
        })
    })
    return combinedArray
}

export async function getCombinedHistoryBmarks(
    query: string,
    nSearchUrls = 0,
): Promise<Array<{ title: string; url: string }>> {
    const [history, bookmarks] = await Promise.all([
        getHistory(query),
        getBookmarks(query),
    ])
    const searchUrls = (await getSearchUrls(query)).slice(0, nSearchUrls)

    const bmarkScore = config.get("bmarkweight")

    // Join records by URL, using the title from bookmarks by preference.
    const combinedMap = new Map<string, any>(
        bookmarks.map(bmark => [
            bmark.url,
            { title: bmark.title, url: bmark.url, bmark, score: bmarkScore },
        ]),
    )
    history.forEach(page => {
        if (combinedMap.has(page.url)) {
            combinedMap.get(page.url).history = page
            combinedMap.get(page.url).score += page.score
        } else {
            combinedMap.set(page.url, {
                title: page.title,
                url: page.url,
                history: page,
                score: page.score,
            })
        }
    })
    searchUrls.forEach(su => {
        combinedMap.set(su.url, {
            title: su.title,
            url: su.url,
            search: true,
            score: su.score,
        })
    })

    return Array.from(combinedMap.values()).sort((a, b) => b.score - a.score)
}
