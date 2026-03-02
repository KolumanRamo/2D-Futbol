import { State, Config } from './config.js';

export const NetworkManager = {
    peer: null,
    conn: null,

    init() {
        if (this.peer) return;

        this.peer = new Peer();

        this.peer.on('open', (id) => {
            console.log('My peer ID is: ' + id);
            State.peerId = id;
            const statusEl = document.getElementById('onlineStatus');
            if (statusEl) statusEl.innerText = "Bağlantı Hazır";
            const myPeerIdEl = document.getElementById('myPeerId');
            if (myPeerIdEl) myPeerIdEl.innerText = id;
        });

        this.peer.on('connection', (connection) => {
            if (State.networkRole === 'host' && !this.conn) {
                this.conn = connection;
                State.conn = connection;
                this.setupConnection();
                console.log('Guest connected!');
            }
        });

        this.peer.on('error', (err) => {
            console.error('PeerJS Error:', err);
            alert('Bağlantı Hatası: ' + err.type);
        });
    },

    host() {
        State.networkRole = 'host';
        State.isOnline = true;
        document.getElementById('myIdDisplay').classList.remove('hidden');
        document.getElementById('onlineStatus').innerText = "Oyuncu bekleniyor...";
    },

    join(remoteId) {
        if (!remoteId) return alert("Lütfen bir oda kodu girin!");

        State.networkRole = 'client';
        State.isOnline = true;
        State.remotePeerId = remoteId;

        this.conn = this.peer.connect(remoteId);
        State.conn = this.conn;
        this.setupConnection();
    },

    setupConnection() {
        this.conn.on('open', () => {
            console.log('Connection established!');
            document.getElementById('onlineMenu').classList.add('hidden');
            // Notify main to start game
            window.dispatchEvent(new CustomEvent('networkReady'));
        });

        this.conn.on('data', (data) => {
            if (data.type === 'input') {
                State.remoteInput = data.input;
            } else if (data.type === 'state') {
                // Client receives state from Host
                this.applyState(data.state);
            }
        });

        this.conn.on('close', () => {
            alert("Bağlantı koptu!");
            location.reload();
        });
    },

    sendInput(input) {
        if (this.conn && this.conn.open) {
            this.conn.send({ type: 'input', input });
        }
    },

    sendState(gameState) {
        if (this.conn && this.conn.open && State.networkRole === 'host') {
            this.conn.send({ type: 'state', state: gameState });
        }
    },

    applyState(remoteState) {
        // Only clients apply remote state
        if (State.networkRole !== 'client') return;

        window.dispatchEvent(new CustomEvent('applyRemoteState', { detail: remoteState }));
    }
};
