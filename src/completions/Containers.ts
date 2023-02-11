import * as Completions from "@src/completions"
import { activeTabContainer } from "@src/lib/webext"
import * as Container from "@src/lib/containers"

class ContainersCompletionOption
    extends Completions.CompletionOptionHTML
    implements Completions.CompletionOptionFuse {
    public fuseKeys = []

    constructor(
        value: string,
        name: string,
        colour: string,
        icon: string,
        prefix: string,
    ) {
        super()
        this.value = prefix + value
        this.fuseKeys.push(value)
        const containerClasses = [colour, icon, name]
            .filter(v => v.length > 0)
            .map(v => "container_" + v)
            .join(" ")
        this.html = html`<tr
            class="ContainersCompletionOption option
            ${containerClasses}"
        >
            <td class="container" ${icon === "" ? "hidden" : ""}></td>
            <td class="name">${value}</td>
        </tr>`
    }
}

export class ContainersCompletionSource extends Completions.CompletionSourceFuse {
    public options: ContainersCompletionOption[]
    excmdArgs = {
        // Indices of argument types for different ex commands
        recontain: { container: 0, includeActive: false },
        containerclose: { container: 0, includeActive: true },
        containerdelete: { container: 0, includeActive: true },
        containerupdate: {
            container: 0,
            name: 1,
            colour: 2,
            icon: 3,
            includeActive: true,
        },
        containercreate: { name: 0, colour: 1, icon: 2 },
    }

    constructor(private _parent) {
        super(
            [
                "recontain",
                "containerclose",
                "containerdelete",
                "containerupdate",
                "containercreate",
            ],
            "ContainersCompletionSource",
            "Containers",
        )

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

    updateChain(query = "", options = this.options) {
        if (options === undefined) {
            this.state = "hidden"
            return
        }

        // Filter by query if query is not empty
        if (query) {
            this.setStateFromScore(this.scoredOptions(query))
            // Else show all options
        } else {
            options.forEach(option => (option.state = "normal"))
        }

        this.updateDisplay()
    }

    private async updateOptions(exstr = "") {
        let [excmd, query] = this.splitOnPrefix(exstr)
        excmd = excmd?.trim()
        const queryTokens = query ? query.split(" ") : []
        let nargs = queryTokens.length
        query = queryTokens[nargs - 1]
        if (nargs > 0) {
            nargs -= 1
        }
        let prefix = queryTokens.slice(0, nargs).join(" ")
        if (prefix.length) {
            prefix += " "
        }
        const argsObj = this.excmdArgs[excmd]

        if (argsObj?.colour === nargs) {
            // Container colour completions
            this.updateSectionHeader("Container colours")
            this.options = Container.ContainerColor.map(colour => {
                const o = new ContainersCompletionOption(
                    colour,
                    "",
                    colour,
                    "circle",
                    prefix,
                )
                o.state = "normal"
                return o
            })
            return this.updateChain(query)
        }
        if (argsObj?.icon === nargs) {
            // Container icon completions
            this.updateSectionHeader("Container icons")
            const colour = queryTokens[argsObj.colour]
            this.options = Container.ContainerIcon.map(icon => {
                const o = new ContainersCompletionOption(
                    icon,
                    "",
                    colour,
                    icon,
                    prefix,
                )
                o.state = "normal"
                return o
            })
            return this.updateChain(query)
        }
        if (argsObj?.container === nargs) {
            // Existing container completions
            this.updateSectionHeader("Containers")
            let containers = await Container.getAll()
            let activeContainer
            try {
                activeContainer = (await activeTabContainer()).name
            } catch {
                activeContainer = "default"
            }
            if (!argsObj.includeActive) {
                containers = containers.filter(
                    container => container.name !== activeContainer,
                )
            }
            this.options = containers.map(container => {
                const o = new ContainersCompletionOption(
                    container.name,
                    container.name,
                    container.color,
                    container.icon,
                    prefix,
                )
                o.state = "normal"
                return o
            })
            if (!argsObj.includeActive && activeContainer !== "default") {
                this.options.unshift(
                    new ContainersCompletionOption(
                        "default",
                        "default",
                        "",
                        "",
                        prefix,
                    ),
                )
            }
            return this.updateChain(query)
        }
        if (argsObj?.name === nargs) {
            // If updating container, suggest current name as new name
            this.updateSectionHeader("New container name")
            if (excmd === "containerupdate") {
                this.options = [
                    new ContainersCompletionOption(
                        queryTokens[0],
                        queryTokens[0],
                        "",
                        "",
                        prefix,
                    ),
                ]
            } else {
                this.options = []
            }
        } else {
            // Otherwise, don't offer completions
            this.updateSectionHeader("Containers")
            this.options = []
        }
        return this.updateChain()
    }

    private updateSectionHeader(newTitle: string) {
        const headerNode = this.node.firstElementChild
        const oldTitle = headerNode.innerHTML
        if (newTitle !== oldTitle) {
            headerNode.innerHTML = newTitle
        }
    }
}
