import * as Completions from "@src/completions"

class SanitiseCompletionOption
    extends Completions.CompletionOptionHTML
    implements Completions.CompletionOptionFuse {
    public fuseKeys = []

    constructor(public name: string, doc: string, prefix: string) {
        super()
        this.value = prefix + name
        this.html = html`<tr class="SanitiseCompletionOption option">
            <td class="name">${name}</td>
            <td class="doc">${doc}</td>
        </tr>`
    }
}

export class SanitiseCompletionSource extends Completions.CompletionSourceFuse {
    public options: SanitiseCompletionOption[]

    private optionDict = [
        { name: "cache", doc: "The browser's cache." },
        { name: "commandline", doc: "Tridactyl's in-memory commandline history.", },
        { name: "cookies", doc: "Cookies acquired while browsing." },
        { name: "downloads", doc: "The user's download history." },
        { name: "formData", doc: "Saved form data, for autocomplete." },
        { name: "history", doc: "The user's browsing history." },
        { name: "localStorage", doc: "Local storage data." },
        { name: "passwords", doc: "Saved passwords, for autocomplete." },
        { name: "serviceWorkers", doc: "Data cached by service workers." },
        { name: "tridactyllocal", doc: "Tridactyl storage local to this machine.", },
        { name: "tridactylsync", doc: "Tridactyl storage associated with your Firefox Account (i.e., all user configuration, by default).", },
    ]

    constructor(private _parent) {
        super(["sanitise"], "SanitiseCompletionSource", "Sanitise")

        this.updateOptions()
        this._parent.appendChild(this.node)
    }

    async filter(exstr: string) {
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

        return this.updateOptions(exstr)
    }

    private async updateOptions(exstr = "") {
        let [_ex, query] = this.splitOnPrefix(exstr)
        const idx = query.lastIndexOf(" ")
        let prefix = ""
        if (idx > -1) {
            prefix = query.substring(0, idx + 1)
            query = query.substring(idx + 1)
        }
        const filteredOptions = this.optionDict.filter(o =>
            o["name"].startsWith(query),
        )
        this.options = await Promise.all(
            filteredOptions.map(async param => {
                const o = new SanitiseCompletionOption(
                    param["name"],
                    param["doc"],
                    prefix,
                )
                o.state = "normal"
                return o
            }),
        )
        return this.updateDisplay()
    }
}
