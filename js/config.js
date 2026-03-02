// js/config.js
export const Config = {
    CANVAS_WIDTH: 1600,
    CANVAS_HEIGHT: 900,
    PLAYER_RADIUS: 30,
    BALL_RADIUS: 18,
    FIELD_MARGIN: 100,
    GOAL_DEPTH: 60,
    PLAYER_ACCELERATION: 0.25,
    PLAYER_FRICTION: 0.92,
    PLAYER_MAX_SPEED: 2.2,
    PLAYER_SPRINT_SPEED: 6.5,
    CHARGE_MAX: 100
};

// Mutable Game State variables that affect everyone
export const State = {
    GOAL_HEIGHT: 200,
    BASE_PLAYER_SPEED: 1.5,
    PLAYER_SPEED: 1.5,

    // Game Flow state
    gameRunning: false,
    gamePaused: false,
    isGoalCelebration: false,
    scoreRed: 0,
    scoreBlue: 0,
    timeRemaining: 120,
    winningScore: 5,
    isVsAI: false,
    p1Name: "Kırmızı",
    p2Name: "Mavi",

    // Modes
    isChaosMode: false,
    hotPotatoMode: false,
    suddenDeathMode: false,
    bombTimer: 0,
    lastTouchedBy: null,

    announcerEnabled: true,

    // Visual / Weather
    weatherCondition: 'sunny',
    rainDrops: [],
    snowFlakes: [],
    grassPattern: null,

    // FX
    cameraFlashes: [],
    crowdEmojis: [],
    celebrationTimer: 0,
    shakeTimer: 0,
    shakeIntensity: 0,
    slowMoTimer: 0,
    slowMoFactor: 1,
    frameCount: 0,
    ballTrail: [],

    // Networking
    isOnline: false,
    networkRole: null, // 'host' or 'client'
    peerId: null,
    remotePeerId: null,
    conn: null,
    isWaitingForGuest: false,
    remoteInput: { up: false, down: false, left: false, right: false, sprint: false, shoot: false, charge: 0 }
};
