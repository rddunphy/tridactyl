import * as Completions from "@src/completions"
import * as Container from "@src/lib/containers"

class ContainersCompletionOption
    extends Completions.CompletionOptionHTML
    implements Completions.CompletionOptionFuse {
    public fuseKeys = []

    constructor(container: browser.contextualIdentities.ContextualIdentity) {
        super()
        this.value = container.name
        this.fuseKeys.push(container.name)
        this.html = html`<tr
            class="ContainersCompletionOption option 
            container_${container.color} container_${container.icon}
            container_${container.name}"
        >
            <td class="container"></td>
            <td class="name">${container.name}</td>
        </tr>`
    }
}

export class ContainersCompletionSource extends Completions.CompletionSourceFuse {
    public options: ContainersCompletionOption[]

    constructor(private _parent) {
        super(
            [
                "recontain",
                "containerclose",
                "containerdelete",
                "containerupdate",
            ],
            "ContainersCompletionSource",
            "Containers",
        )

        this.updateOptions()
        this._parent.appendChild(this.node)
    }

    async filter(exstr: string) {
        this.lastExstr = exstr
        return this.updateOptions(exstr)
    }

    private async updateOptions(exstr = "") {
        const [_ex, query] = this.splitOnPrefix(exstr)
        if (query && query.split(" ").length > 1) {
            this.options = []
            return this.updateChain()
        }
        const containers = await Container.getAll()

        this.options = await Promise.all(
            containers.map(async container => {
                const o = new ContainersCompletionOption(container)
                o.state = "normal"
                return o
            }),
        )
        return this.updateChain()
    }
}
