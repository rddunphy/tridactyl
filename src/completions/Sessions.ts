import { browserBg } from "@src/lib/webext"
import * as Completions from "@src/completions"
import * as config from "@src/lib/config"

function computeDate(session) {
    let howLong = Math.round(
        ((new Date() as any) - session.lastModified) / 1000,
    )
    let qualifier = "s"
    if (Math.abs(howLong) > 60) {
        qualifier = "m"
        howLong = Math.round(howLong / 60)
        if (Math.abs(howLong) > 60) {
            qualifier = "h"
            howLong = Math.round(howLong / 60)
            if (Math.abs(howLong) > 24) {
                qualifier = "d"
                howLong = Math.round(howLong / 24)
            }
        }
    }
    return [howLong, qualifier]
}

function getTabInfo(session) {
    let tab
    let extraInfo
    if (session.tab) {
        tab = session.tab
        extraInfo = html`<a class="url" target="_blank" href="${tab.url}"
            >${tab.url}</a
        >`
    } else {
        tab = session.window.tabs.sort(
            (a, b) => b.lastAccessed - a.lastAccessed,
        )[0]
        const tabCount = session.window.tabs.length
        if (tabCount < 2) {
            extraInfo = html`<a class="url" target="_blank" href="${tab.url}"
                >${tab.url}</a
            >`
        } else {
            extraInfo = html`${tabCount - 1} more tab${tabCount > 2 ? "s" : ""}`
        }
    }
    return [tab, extraInfo]
}

class SessionCompletionOption
    extends Completions.CompletionOptionHTML
    implements Completions.CompletionOptionFuse {
    public fuseKeys = []

    constructor(public session) {
        super()
        this.value = (session.tab || session.window).sessionId
        const [howLong, qualifier] = computeDate(session)
        const [tab, extraInfo] = getTabInfo(session)
        const preplain = session.tab ? "T" : "W"
        let pre
        if (config.get("completions", "Tab", "statusstylepretty") === "true") {
            pre = session.tab
                ? config.get("statusstyleprettyicons", "tab")
                : config.get("statusstyleprettyicons", "window")
            this.fuseKeys.push(pre)
        } else {
            pre = preplain
        }
        this.fuseKeys.push(preplain, tab.title, tab.url)
        this.html = html`<tr class="SessionCompletionOption option">
            <td class="prefix"></td>
            <td class="time">${howLong}${qualifier}</td>
            <td class="icon">
                <img src="${tab.favIconUrl || Completions.DEFAULT_FAVICON}" />
            </td>
            <td class="title">${tab.title}</td>
            <td class="content"></td>
        </tr>`
        this.html.firstElementChild.innerHTML = pre
        this.html.lastElementChild.appendChild(extraInfo)
    }
}

export class SessionsCompletionSource extends Completions.CompletionSourceFuse {
    public options: SessionCompletionOption[]
    private shouldSetStateFromScore = true

    constructor(private _parent) {
        super(["undo"], "SessionCompletionSource", "sessions")

        this.updateOptions()
        this.shouldSetStateFromScore =
            config.get("completions", "Sessions", "autoselect") === "true"
        this._parent.appendChild(this.node)
    }

    async onInput(exstr) {
        return this.updateOptions(exstr)
    }

    setStateFromScore(scoredOpts: Completions.ScoredOption[]) {
        super.setStateFromScore(scoredOpts, this.shouldSetStateFromScore)
    }

    private async updateOptions(exstr = "") {
        this.lastExstr = exstr
        const [prefix] = this.splitOnPrefix(exstr)

        // Hide self and stop if prefixes don't match
        if (prefix) {
            // Show self if prefix and currently hidden
            if (this.state === "hidden") {
                this.state = "normal"
            }
        } else {
            this.state = "hidden"
            return
        }

        const sessions = await browserBg.sessions.getRecentlyClosed()
        this.options = sessions.map(s => new SessionCompletionOption(s))
    }
}
