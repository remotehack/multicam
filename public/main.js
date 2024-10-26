const params = new URLSearchParams(location.search)
const name = params.get('c')


const create = document.querySelector('#create');
const main = document.querySelector('main');

if (!name) {
    create.setAttribute('href', `?c=${crypto.randomUUID()}`)
    main.remove()
} else {
    create.remove()

    ui('name', name)


    const wsurl = location.origin.replace('http', 'ws') + '/' + name + '/sock'
    const socket = new WebSocket(wsurl)
    ui('cams', 'connecting')

    socket.addEventListener('open', () => {
        ui('cams', 'open')
    })

    socket.addEventListener('close', () => {
        ui('cams', 'closed')
    })
    socket.addEventListener('message', (e) => {
        console.log("MESSAGe", e.data)

        try {
            const j = JSON.parse(e.data)
            if (j.type === 'presence') {
                const { count } = j.payload
                ui('cams', count === 1 ? '1 camera' : `${count} cameras`)
            }

        } catch (e) {
            console.error(e)
        }
    })

}



///
function ui(name, value) {
    const el = document.querySelector(`[data-bind=${name}]`)
    if (el) el.innerText = value
}

function plural(count, one, other) {
    return count === 1 ? one : other

}
