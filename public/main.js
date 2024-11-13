import { ImageCapture } from "https://esm.sh/image-capture@0.4.0"

const params = new URLSearchParams(location.search)
const name = params.get('c')

/*
fsm might be nice:
    idle | connected | ready-to-capture | capture-image | capture-video | capture-audio

    just for the camera?

    bbb/megacam?session=mkgn
    bbb/megacam/camera?session=mkgn

    // BROADCASTING
    /sock/session?host=key
    /sock/session?member=name

    > state[idle]
    > state[image-ready] [selfie?]
    > state[audio-ready]

    >> state[image-capture, at]

    > action[image-capture, atTimestamp, uploadToken1, captureId, assetId]
    > action[audio-capture, atTimestamp, uploadToken2, captureId, assetId]
    > action[video-capture, atTimestamp, uploadToken3, captureId, assetId]

    // on upload complete
    < success[image, name, asset123.jpg]

    // Client

    POST /image/session [file.jpg, token]
    POST /audio/session [file.jpg, token]
    POST /video/session [file.jpg, token]
    
    // unique for each client
    < capture-image{token, time}

    POST /image/:session/:capture/:asset

    // database
    // offloads:
        // session - [the session id]
        // capture - [the name of the capture] 
        // asset - [a specific id for that client]
        // type - image | audio | video
        // state - waiting | uploading | done | failed
        // url - [the place where it might be uploaded]

*/

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
            if (j.type === 'broadcast' && j.payload == 'capture:picture') {
                captureImage()
            }

        } catch (e) {
            console.error(e)
        }
    })

    document.querySelector('#capture_picture').addEventListener('click', () => {
        socket.send(JSON.stringify({ type: 'broadcast', payload: 'capture:picture' }))
    })


    // const button = document.querySelector('#capture button')
    // button.addEventListener('click', () => {

    // Get access to the user's media devices
    navigator.mediaDevices.getUserMedia({
        video: {
            width: { ideal: 4096 },
            height: { ideal: 2160 }
        }, audio: false
    })
        .then(stream => {

            let video = document.querySelector('video');

            video.srcObject = stream;
        })
        .catch(error => {
            console.error('Error accessing media devices.', error);
        });

    // })


}

function captureImage() {
    let video = document.querySelector('video');
    if (video?.srcObject) {
        const track = video.srcObject.getVideoTracks()[0];
        const imageCapture = new ImageCapture(track);
        imageCapture.takePhoto()
            .then((blob) => {
                console.log("Took photo:", blob);
                const img = new Image;
                img.src = URL.createObjectURL(blob);
                document.body.append(img)
                img.style.height = '100px'

                // upload
                // fetch(, {})
                const url = '/' + name + '/image'

                const formData = new FormData();
                formData.append('file', new File([bytes], 'image.png'));
                fetch(url, {
                    method: 'POST',
                    headers: {
                        //   'Authorization': `Bearer ${TOKEN}`,
                    },
                    body: formData,
                }).then(r => {
                    console.log("DONE", r)
                })
            })
            .catch((error) => {
                console.error("takePhoto() error: ", error);
            });
    }


}
window.captureImage = captureImage


///
function ui(name, value) {
    const el = document.querySelector(`[data-bind=${name}]`)
    if (el) el.innerText = value
}
