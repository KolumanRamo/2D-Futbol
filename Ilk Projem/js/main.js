// js/main.js
import { Config, State } from './config.js';
import { currentLang, t } from './lang.js';
import { SoundManager } from './audio.js';
import { Particle, particles, powerUps, PowerUp, createParticles } from './particles.js';
import { applyShake, startSlowMo, createExplosion, applyExplosionForce } from './utils.js';
import { player1, player2, ball, aiController } from './entities.js';
import { ChaosManager } from './chaos.js';
import { ReplayManager } from './replay.js';
import { applyWeatherPhysics, updateWeatherEffects, drawWeatherEffects } from './weather.js';
import { NetworkManager } from './network.js';
import { keys } from './input.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const scoreRedEl = document.getElementById('scoreRed');
const scoreBlueEl = document.getElementById('scoreBlue');
const timerEl = document.getElementById('timer');
const winnerText = document.getElementById('winnerText');
const pauseMenu = document.getElementById('pauseMenu');

const p1NameInput = document.getElementById('p1NameInput');
const p2NameInput = document.getElementById('p2NameInput');
const durationInput = document.getElementById('durationInput');
const goalLimitInput = document.getElementById('goalLimitInput');
const soundToggle = document.getElementById('soundToggle');
const goalNotification = document.getElementById('goalNotification');
const goalText = document.getElementById('goalText');

let timerInterval;

window.addEventListener('langChanged', () => {
    SoundManager.setLang(currentLang);
});

function initGame() {
    State.gameRunning = true;
    State.scoreRed = 0;
    State.scoreBlue = 0;

    State.p1Name = p1NameInput.value || t('default_red');
    State.p2Name = p2NameInput.value || t('default_blue');
    let durationMins = parseInt(durationInput.value) || 2;
    if (durationMins > 10) durationMins = 10;
    if (durationMins < 1) durationMins = 1;
    State.winningScore = parseInt(goalLimitInput.value) || 5;

    SoundManager.setSoundEnabled(soundToggle.checked);

    const mode = document.querySelector('input[name="gameMode"]:checked').value;
    if (mode === '1p') {
        State.isVsAI = true;
        player2.controls = 'ai';
        aiController.timer = 0;
    } else {
        State.isVsAI = false;
        player2.controls = 'arrows';
    }

    // Chaos mode and other config evaluation moved below

    const hotPotatoCheck = document.getElementById('hotPotatoMode');
    State.hotPotatoMode = hotPotatoCheck ? hotPotatoCheck.checked : false;
    if (State.hotPotatoMode) {
        State.bombTimer = 900;
        State.lastTouchedBy = null;
    }

    const suddenDeathCheck = document.getElementById('suddenDeathMode');
    State.suddenDeathMode = suddenDeathCheck ? suddenDeathCheck.checked : false;
    if (State.suddenDeathMode) {
        State.winningScore = 1;
        durationMins = 99;
    }

    const announcerCheck = document.getElementById('announcerToggle');
    State.announcerEnabled = announcerCheck ? announcerCheck.checked : false;

    const nightCheck = document.getElementById('nightModeToggle');
    State.nightMode = nightCheck ? nightCheck.checked : false;
    State.grassBitmap = null; // Forces recreate with new colors

    if (State.announcerEnabled) {
        setTimeout(() => SoundManager.speak(t('start_btn')), 500);
    }

    const ballTypeInput = document.querySelector('input[name="ballType"]:checked');
    const ballType = ballTypeInput ? ballTypeInput.value : 'normal';
    ball.setType(ballType);

    const weatherInput = document.querySelector('input[name="weatherType"]:checked');
    State.weatherCondition = weatherInput ? weatherInput.value : 'sunny';
    applyWeatherPhysics();

    const chaosCheck = document.getElementById('chaosMode');
    State.isChaosMode = chaosCheck ? chaosCheck.checked : false;
    if (State.isChaosMode) {
        ChaosManager.trigger();
    } else {
        ChaosManager.reset();
    }

    State.timeRemaining = durationMins * 60;

    updateScoreboard();
    updateTimerDisplay();
    resetPositions();

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    goalNotification.classList.add('hidden');

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
    SoundManager.playWhistle();

    requestAnimationFrame(gameLoop);
}

function resetPositions() {
    player1.x = 150 + Config.FIELD_MARGIN;
    player1.y = Config.CANVAS_HEIGHT / 2;
    player1.vx = 0;
    player1.vy = 0;
    player1.activePowerUp = null;
    player1.powerUpTimer = 0;

    player2.x = Config.CANVAS_WIDTH - 150 - Config.FIELD_MARGIN;
    player2.y = Config.CANVAS_HEIGHT / 2;
    player2.vx = 0;
    player2.vy = 0;
    player2.activePowerUp = null;
    player2.powerUpTimer = 0;

    ball.x = Config.CANVAS_WIDTH / 2;
    ball.y = Config.CANVAS_HEIGHT / 2;
    ball.vx = 0;
    ball.vy = 0;

    // Clear all active powerups from field
    powerUps.length = 0;
}

function handleGoal(scoringTeam) {
    if (State.isGoalCelebration) return;
    State.isGoalCelebration = true;

    if (scoringTeam === 'red') {
        State.scoreRed++;
        if (State.scoreRed >= State.winningScore) {
            State.scoreRed = State.winningScore;
            endGame();
            return;
        }
    } else {
        State.scoreBlue++;
        if (State.scoreBlue >= State.winningScore) {
            State.scoreBlue = State.winningScore;
            endGame();
            return;
        }
    }

    updateScoreboard();

    const scorerName = (scoringTeam === 'red') ? State.p1Name : State.p2Name;
    goalText.innerText = `${scorerName.toUpperCase()} ${t('goal_text')}`;
    goalNotification.classList.remove('hidden');

    startSlowMo(120, 0.1);
    SoundManager.playGoal();
    SoundManager.playExplosion();

    createExplosion(ball.x, ball.y);
    applyExplosionForce(ball.x, ball.y, [player1, player2, ball]);
    applyShake(25, 40); // Increased intensity

    const scorer = (scoringTeam === 'red') ? player1 : player2;
    scorer.celebrating = true;
    scorer.celebrationTimer = 180;

    State.celebrationTimer = 180;

    // Start replay after a small delay
    setTimeout(() => {
        if (State.gameRunning) ReplayManager.start();
    }, 1000);

    // Increase total wait time to account for replay (approx 12s)
    // But we'll call resetPositions inside ReplayManager.stop or check it in gameLoop
    State.goalWaitTimer = 800; // Custom timer to handle reset after replay
}

function updateScoreboard() {
    scoreRedEl.innerText = State.scoreRed;
    scoreBlueEl.innerText = State.scoreBlue;
}

function updateTimer() {
    if (!State.gameRunning) return;

    State.timeRemaining--;
    updateTimerDisplay();

    if (State.timeRemaining <= 0) {
        endGame();
    }
}

function updateTimerDisplay() {
    let minutes = Math.floor(State.timeRemaining / 60);
    let seconds = State.timeRemaining % 60;
    timerEl.innerText = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

function endGame() {
    State.gameRunning = false;
    clearInterval(timerInterval);

    let winner;
    if (State.scoreRed > State.scoreBlue) {
        winner = `${State.p1Name.toUpperCase()} ${t('won')}`;
    } else if (State.scoreBlue > State.scoreRed) {
        winner = `${State.p2Name.toUpperCase()} ${t('won')}`;
    } else {
        winner = t('draw_text') || "BERABERE";
    }

    winnerText.innerText = winner;
    gameOverScreen.classList.remove('hidden');

    if (State.announcerEnabled) {
        SoundManager.speak(winner);
    }
}

function togglePause() {
    if (!State.gameRunning) return;
    State.gamePaused = !State.gamePaused;

    if (State.gamePaused) {
        pauseMenu.classList.remove('hidden');
    } else {
        pauseMenu.classList.add('hidden');
        requestAnimationFrame(gameLoop);
    }
}

function drawGoal(ctx, x, y, depth, height, isLeft) {
    const backX = isLeft ? x - depth : x + depth;
    const midY = y + height / 2;
    ctx.save();

    // ---- Net shadow fill ----
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(backX, y);
    ctx.lineTo(backX, y + height);
    ctx.lineTo(x, y + height);
    ctx.closePath();
    ctx.fill();

    // ---- Net mesh: vertical lines ----
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 0.8;
    const netSpacing = 10;
    for (let i = 0; i <= Math.abs(depth); i += netSpacing) {
        const nx = isLeft ? x - i : x + i;
        // Perspective: lines slightly converge toward back
        const perspY1 = y + i * 0.05;
        const perspY2 = y + height - i * 0.05;
        ctx.beginPath();
        ctx.moveTo(nx, perspY1);
        ctx.lineTo(nx, perspY2);
        ctx.stroke();
    }
    // ---- Net mesh: horizontal lines ----
    for (let i = 0; i <= height; i += netSpacing) {
        const ny = y + i;
        ctx.beginPath();
        ctx.moveTo(x, ny);
        ctx.lineTo(backX, ny + (isLeft ? -i * 0.04 : i * 0.04));
        ctx.stroke();
    }

    // ---- Crossbar (top post) ----
    const postGrad = ctx.createLinearGradient(backX, y, x, y);
    postGrad.addColorStop(0, '#aaaaaa');
    postGrad.addColorStop(0.4, '#ffffff');
    postGrad.addColorStop(1, '#cccccc');
    ctx.strokeStyle = postGrad;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(backX, y);
    ctx.stroke();

    // ---- Bottom bar ----
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(backX, y + height);
    ctx.stroke();

    // ---- Back post ----
    ctx.beginPath();
    ctx.moveTo(backX, y);
    ctx.lineTo(backX, y + height);
    ctx.stroke();

    // ---- Front posts (two circles = top and bottom pegs on goal mouth) ----
    const drawPost = (px, py) => {
        const g = ctx.createRadialGradient(px - 2, py - 2, 1, px, py, 7);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.5, '#d0d0d0');
        g.addColorStop(1, '#888888');
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.stroke();
    };
    drawPost(x, y);
    drawPost(x, y + height);

    // ---- Goal mouth line on field ----
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + height);
    ctx.stroke();

    ctx.restore();
}

function createGrassPattern() {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = Config.CANVAS_WIDTH;
    pCanvas.height = Config.CANVAS_HEIGHT;
    const pCtx = pCanvas.getContext('2d');

    const stripeW = 120;
    const darkGrass = State.nightMode ? '#1e3f23' : '#3a7d44';
    const lightGrass = State.nightMode ? '#2a5a31' : '#4CAF50';

    for (let i = 0; i < Config.CANVAS_WIDTH; i += stripeW) {
        const color = Math.floor(i / stripeW) % 2 === 0 ? darkGrass : lightGrass;
        // Base color
        pCtx.fillStyle = color;
        pCtx.fillRect(i, 0, stripeW, Config.CANVAS_HEIGHT);
        // Add subtle grass texture within stripe
        for (let j = 0; j < 200; j++) {
            const gx = i + Math.random() * stripeW;
            const gy = Math.random() * Config.CANVAS_HEIGHT;
            const brightness = Math.random() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
            pCtx.fillStyle = brightness;
            pCtx.fillRect(gx, gy, 2, 3 + Math.random() * 4);
        }
        // Subtle gradient along each stripe (top lighter, bottom slightly darker)
        const sg = pCtx.createLinearGradient(0, 0, 0, Config.CANVAS_HEIGHT);
        sg.addColorStop(0, 'rgba(255,255,255,0.06)');
        sg.addColorStop(0.5, 'rgba(255,255,255,0)');
        sg.addColorStop(1, 'rgba(0,0,0,0.08)');
        pCtx.fillStyle = sg;
        pCtx.fillRect(i, 0, stripeW, Config.CANVAS_HEIGHT);
    }

    return pCanvas;
}

function drawField() {
    if (!State.grassBitmap) State.grassBitmap = createGrassPattern();

    // Draw the pre-rendered grass
    ctx.drawImage(State.grassBitmap, 0, 0);

    // Stadium floodlight shafts
    ctx.save();
    for (let i = 0; i < 4; i++) {
        const lx = (Config.CANVAS_WIDTH / 5) * (i + 1);
        const grad = ctx.createLinearGradient(lx, 0, lx, Config.CANVAS_HEIGHT);
        grad.addColorStop(0, 'rgba(255,255,240,0.07)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.04)');
        grad.addColorStop(1, 'rgba(255,255,240,0.07)');
        ctx.fillStyle = grad;
        ctx.fillRect(lx - 30, 0, 60, Config.CANVAS_HEIGHT);
    }
    ctx.restore();

    // Field lines — with glow
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.6)';
    ctx.shadowBlur = 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    // Outer boundary
    ctx.strokeRect(75, 30, Config.CANVAS_WIDTH - 150, Config.CANVAS_HEIGHT - 60);

    // Halfway line
    ctx.beginPath();
    ctx.moveTo(Config.CANVAS_WIDTH / 2, 30);
    ctx.lineTo(Config.CANVAS_WIDTH / 2, Config.CANVAS_HEIGHT - 30);
    ctx.stroke();

    // Centre circle
    ctx.beginPath();
    ctx.arc(Config.CANVAS_WIDTH / 2, Config.CANVAS_HEIGHT / 2, 90, 0, Math.PI * 2);
    ctx.stroke();

    // Centre spot
    ctx.beginPath();
    ctx.arc(Config.CANVAS_WIDTH / 2, Config.CANVAS_HEIGHT / 2, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();

    // Penalty spots
    ctx.beginPath();
    ctx.arc(Config.FIELD_MARGIN + 80, Config.CANVAS_HEIGHT / 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(Config.CANVAS_WIDTH - Config.FIELD_MARGIN - 80, Config.CANVAS_HEIGHT / 2, 5, 0, Math.PI * 2);
    ctx.fill();

    // Penalty areas
    const penW = 140, penH = 280;
    const penTop = (Config.CANVAS_HEIGHT - penH) / 2;
    ctx.strokeRect(75, penTop, penW, penH);
    ctx.strokeRect(Config.CANVAS_WIDTH - 75 - penW, penTop, penW, penH);

    // Corner arcs
    const corners = [
        [75, 30, 0, Math.PI * 0.5],
        [75, Config.CANVAS_HEIGHT - 30, Math.PI * 1.5, 0],
        [Config.CANVAS_WIDTH - 75, 30, Math.PI * 0.5, Math.PI],
        [Config.CANVAS_WIDTH - 75, Config.CANVAS_HEIGHT - 30, Math.PI, Math.PI * 1.5]
    ];
    corners.forEach(([cx, cy, sa, ea]) => {
        ctx.beginPath();
        ctx.arc(cx, cy, 22, sa, ea);
        ctx.stroke();
    });

    ctx.restore();

    // Goals
    const goalTop = (Config.CANVAS_HEIGHT - State.GOAL_HEIGHT) / 2;
    const goalDepth = 60;
    if (!State.hotPotatoMode) {
        drawGoal(ctx, Config.FIELD_MARGIN, goalTop, goalDepth, State.GOAL_HEIGHT, true);
        drawGoal(ctx, Config.CANVAS_WIDTH - Config.FIELD_MARGIN, goalTop, goalDepth, State.GOAL_HEIGHT, false);
    }

    // Vignette overlay
    ctx.save();
    const vig = ctx.createRadialGradient(
        Config.CANVAS_WIDTH / 2, Config.CANVAS_HEIGHT / 2, Config.CANVAS_HEIGHT * 0.3,
        Config.CANVAS_WIDTH / 2, Config.CANVAS_HEIGHT / 2, Config.CANVAS_WIDTH * 0.75
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT);
    ctx.restore();

    drawWeatherEffects(ctx);

    // Night Mode Lighting (Overlays)
    if (State.nightMode) {
        // Ambient darkness overlay
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgba(8, 12, 35, 0.78)';
        ctx.fillRect(0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT);
        ctx.restore();

        // High-quality Stadium Spotlights
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const spots = [
            [0, 0], [Config.CANVAS_WIDTH, 0],
            [0, Config.CANVAS_HEIGHT], [Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT]
        ];
        spots.forEach(([sx, sy]) => {
            const grad = ctx.createRadialGradient(sx, sy, 50, sx, sy, 800);
            grad.addColorStop(0, 'rgba(255, 255, 230, 0.4)');
            grad.addColorStop(0.3, 'rgba(255, 255, 230, 0.15)');
            grad.addColorStop(1, 'rgba(255, 255, 230, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT);

            // Volumetric light beams
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            const bx = sx < Config.CANVAS_WIDTH / 2 ? sx + 300 : sx - 300;
            ctx.lineTo(bx, sy + 600);
            ctx.lineTo(bx + (sx < Config.CANVAS_WIDTH / 2 ? 400 : -400), sy + 600);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fill();
        });
        ctx.restore();
    }
}

function drawShadows() {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";

    // Players shadows
    [player1, player2].forEach(p => {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + p.radius - 5, p.radius * 0.8, p.radius * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
    });

    // Ball shadow
    ctx.beginPath();
    const ballShadowWidth = ball.radius * (1 + (ball.vy / 20) * 0.2); // Subtle width change with speed
    ctx.ellipse(ball.x, ball.y + ball.radius - 2, ballShadowWidth, ball.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawBallTrail() {
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed > 8) {
        State.ballTrail.push({ x: ball.x, y: ball.y, alpha: 0.6, color: ball.color });
    }

    if (State.ballTrail.length > 12) State.ballTrail.shift();

    ctx.save();
    for (let i = 0; i < State.ballTrail.length; i++) {
        const p = State.ballTrail[i];
        p.alpha -= 0.045;
        if (p.alpha <= 0) continue;

        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color || "white";
        ctx.beginPath();
        ctx.arc(p.x, p.y, ball.radius * (i / State.ballTrail.length), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    State.ballTrail = State.ballTrail.filter(p => p.alpha > 0);
}

function drawPostProcessing() {
    // Subtle bloom and contrast for Professional look
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT);

    // Hint of saturation/vibrance
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT);
    ctx.restore();
}

function updateAndDrawFanEffects() {
    if (State.celebrationTimer > 0) {
        State.celebrationTimer--;

        if (Math.random() < 0.2) {
            State.cameraFlashes.push({
                x: Math.random() * Config.CANVAS_WIDTH,
                y: Math.random() * Config.CANVAS_HEIGHT,
                radius: 20 + Math.random() * 50,
                alpha: 1.0,
                life: 10
            });
        }

        if (Math.random() < 0.1) {
            const emojis = ['👏', '🔥', '⚽', '🎉', '📸', '🙌'];
            const emoji = emojis[Math.floor(Math.random() * emojis.length)];
            const side = Math.random() < 0.5 ? 'top' : 'bottom';
            const startY = side === 'top' ? -20 : Config.CANVAS_HEIGHT + 20;
            const vy = side === 'top' ? 2 + Math.random() * 2 : -2 - Math.random() * 2;

            State.crowdEmojis.push({
                x: Math.random() * Config.CANVAS_WIDTH,
                y: startY,
                emoji: emoji,
                vy: vy,
                alpha: 1.0,
                life: 60
            });
        }
    }

    for (let i = State.cameraFlashes.length - 1; i >= 0; i--) {
        const flash = State.cameraFlashes[i];
        flash.life--;
        flash.alpha = flash.life / 10;

        if (flash.life <= 0) {
            State.cameraFlashes.splice(i, 1);
            continue;
        }

        ctx.save();
        ctx.globalAlpha = flash.alpha * 0.6;
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(flash.x, flash.y, flash.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    ctx.save();
    ctx.font = "30px Arial";
    ctx.textAlign = "center";
    for (let i = State.crowdEmojis.length - 1; i >= 0; i--) {
        const item = State.crowdEmojis[i];
        item.y += item.vy;
        item.life--;
        item.alpha = Math.min(1, item.life / 20);

        if (item.life <= 0) {
            State.crowdEmojis.splice(i, 1);
            continue;
        }

        ctx.globalAlpha = item.alpha;
        ctx.fillText(item.emoji, item.x, item.y);
    }
    ctx.restore();
}

function checkPlayerBallCollision(player) {
    const dx = ball.x - player.x;
    const dy = ball.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = player.radius + ball.radius;

    if (distance < minDistance) {
        const angle = Math.atan2(dy, dx);
        const overlap = minDistance - distance;

        ball.x += Math.cos(angle) * (overlap + 2);
        ball.y += Math.sin(angle) * (overlap + 2);

        const pushFactor = player.isSprinting ? 0.9 : 0.75;
        const playerSpeed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
        if (playerSpeed > 0.1) {
            ball.vx = player.vx * pushFactor;
            ball.vy = player.vy * pushFactor;
        } else {
            ball.vx += Math.cos(angle) * 1.5;
            ball.vy += Math.sin(angle) * 1.5;
        }

        SoundManager.playWall();

        if (State.hotPotatoMode) {
            State.lastTouchedBy = (player === player1) ? 'red' : 'blue';
            ball.color = (player === player1) ? '#ff4757' : '#2e86de';
            State.bombTimer = 900;
        }
    }
}

function checkPlayerPlayerCollision(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = p1.radius + p2.radius;

    if (distance < minDistance) {
        const angle = Math.atan2(dy, dx);
        const overlap = minDistance - distance;

        p1.x -= Math.cos(angle) * overlap / 2;
        p1.y -= Math.sin(angle) * overlap / 2;
        p2.x += Math.cos(angle) * overlap / 2;
        p2.y += Math.sin(angle) * overlap / 2;


        const force = 2;
        p1.vx -= Math.cos(angle) * force;
        p1.vy -= Math.sin(angle) * force;
        p2.vx += Math.cos(angle) * force;
        p2.vy += Math.sin(angle) * force;
    }
}

function gameLoop(timestamp) {
    if (!State.gameRunning) return;

    if (State.gamePaused) {
        requestAnimationFrame(gameLoop);
        return;
    }

    State.frameCount++;
    let shouldUpdate = true;
    if (State.slowMoTimer > 0) {
        State.slowMoTimer--;
        if (State.frameCount % State.slowMoFactor !== 0) {
            shouldUpdate = false;
        }
    } else {
        State.slowMoFactor = 1;
    }

    ctx.clearRect(0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT);

    ctx.save();
    if (State.shakeTimer > 0) {
        const dx = (Math.random() - 0.5) * State.shakeIntensity;
        const dy = (Math.random() - 0.5) * State.shakeIntensity;
        ctx.translate(dx, dy);
        State.shakeTimer--;
    }

    drawField();

    if (State.replayActive) {
        const snapshot = ReplayManager.getSnapshot();
        if (snapshot) {
            // Hide goal notification during replay
            goalNotification.classList.add('hidden');

            // Apply snapshot - FORCE NO CELEBRATION OR STUN during replay
            player1.x = snapshot.p1.x; player1.y = snapshot.p1.y;
            player1.facingRight = snapshot.p1.facingRight;
            player1.animTimer = snapshot.p1.animTimer;
            player1.celebrating = false;

            player2.x = snapshot.p2.x; player2.y = snapshot.p2.y;
            player2.facingRight = snapshot.p2.facingRight;
            player2.animTimer = snapshot.p2.animTimer;
            player2.celebrating = false;

            ball.x = snapshot.ball.x; ball.y = snapshot.ball.y;
            ball.angle = snapshot.ball.angle;

            // Replay HUD
            ctx.fillStyle = "#f1c40f";
            ctx.font = "bold 32px Arial";
            ctx.textAlign = "left";
            ctx.shadowColor = "rgba(0,0,0,0.5)";
            ctx.shadowBlur = 8;
            ctx.fillText(t('replay_label'), 60, 60);
            ctx.shadowBlur = 0;
        } else {
            ReplayManager.stop();
            // Replay finished, show goal notification again if celebration is still active
            if (State.isGoalCelebration) {
                resetPositions();
                State.isGoalCelebration = false;
                goalNotification.classList.add('hidden');
                if (State.isChaosMode && State.scoreRed < State.winningScore && State.scoreBlue < State.winningScore) {
                    ChaosManager.trigger();
                } else {
                    ChaosManager.reset();
                }
            }
        }
    }

    if (shouldUpdate && !State.replayActive && !State.isGoalCelebration) {
        ReplayManager.capture(State.frameCount);
        updateWeatherEffects();

        for (const p of [player1, player2]) {
            p.update();
            if (p.isCharging && !p.frozen) {
                p.charge += (p.isSprinting ? 1.5 : 1.0);
                if (p.charge > 100) p.charge = 100;
                if (p.charge > 85 && Math.random() < 0.25) applyShake(2, 3);
            } else if (p.charge > 0) {
                tryKick(p);
                if (p.charge > 90) applyShake(12, 12);
                p.charge = 0;
            }
        }

        ball.update(handleGoal);

        if (State.hotPotatoMode && !State.isGoalCelebration) {
            State.bombTimer--;

            const flashRate = State.bombTimer < 180 ? 5 : (State.bombTimer < 360 ? 10 : 20);

            if (!State.lastTouchedBy) {
                if (Math.floor(State.bombTimer / flashRate) % 2 === 0) ball.color = '#ff0000';
                else ball.color = '#ff6600';
            }

            if (State.bombTimer <= 0) {
                let loser = State.lastTouchedBy;

                if (!loser) {
                    if (ball.x < Config.CANVAS_WIDTH / 2) loser = 'red';
                    else loser = 'blue';
                }

                const scoringTeam = (loser === 'red') ? 'blue' : 'red';

                createExplosion(ball.x, ball.y);
                applyExplosionForce(ball.x, ball.y, [player1, player2, ball]);
                SoundManager.playExplosion();
                applyShake(15, 30);

                handleGoal(scoringTeam);

                State.bombTimer = 600 + Math.floor(Math.random() * 300);
                State.lastTouchedBy = null;
                ball.color = '#ffffff';
            }
        }

        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            if (particles[i].life <= 0) {
                particles.splice(i, 1);
            }
        }

        // Power-ups ONLY spawn in Chaos mode
        if (State.isChaosMode && Math.random() < 0.0013 && powerUps.length < 2) {
            const types = ['speed', 'shot', 'freeze', 'tiny_ball', 'big_goals', 'confusion'];
            const type = types[Math.floor(Math.random() * types.length)];
            const x = Config.FIELD_MARGIN + 50 + Math.random() * (Config.CANVAS_WIDTH - Config.FIELD_MARGIN * 2 - 100);
            const y = Config.FIELD_MARGIN + 50 + Math.random() * (Config.CANVAS_HEIGHT - Config.FIELD_MARGIN * 2 - 100);
            powerUps.push(new PowerUp(x, y, type));
        }

        for (let i = powerUps.length - 1; i >= 0; i--) {
            const p = powerUps[i];
            p.update();
            if (p.life <= 0) {
                powerUps.splice(i, 1);
                continue;
            }
            let picked = false;
            for (const player of [player1, player2]) {
                if (picked) break;
                const dx = player.x - p.x;
                const dy = player.y - p.y;
                if (Math.sqrt(dx * dx + dy * dy) < player.radius + p.radius) {
                    player.applyPowerUp(p.type);
                    powerUps.splice(i, 1);
                    createParticles(p.x, p.y, '#ffffff', 10);
                    SoundManager.playWhistle();
                    picked = true;
                }
            }
        }

        checkPlayerBallCollision(player1);
        checkPlayerBallCollision(player2);
    }

    drawShadows();
    drawBallTrail();
    for (let p of powerUps) p.draw(ctx);
    for (let p of particles) p.draw(ctx);

    player1.draw(ctx);
    player2.draw(ctx);
    ball.draw(ctx);

    if (State.hotPotatoMode) {
        const seconds = Math.ceil(State.bombTimer / 60);
        ctx.save();
        ctx.font = 'bold 28px Fredoka One';
        ctx.textAlign = 'center';
        ctx.fillStyle = State.bombTimer < 180 ? '#ff0000' : '#ff6600';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = State.bombTimer < 180 ? 20 : 10;
        ctx.fillText(`💣 ${seconds}`, ball.x, ball.y - ball.radius - 15);
        ctx.restore();

        ctx.save();
        ctx.setLineDash([15, 10]);
        ctx.strokeStyle = 'rgba(255, 50, 50, 0.7)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(Config.CANVAS_WIDTH / 2, 0);
        ctx.lineTo(Config.CANVAS_WIDTH / 2, Config.CANVAS_HEIGHT);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    updateAndDrawFanEffects();
    drawPostProcessing();

    ctx.restore();

    ctx.fillStyle = "white";
    ctx.font = "14px Fredoka One";
    ctx.textAlign = "center";
    ctx.fillText(State.p1Name, player1.x, player1.y - 45);
    ctx.fillText(State.p2Name, player2.x, player2.y - 45);

    // --- Networking Sync ---
    if (State.isOnline && State.networkRole === 'host') {
        const scorePack = {
            scoreRed: State.scoreRed,
            scoreBlue: State.scoreBlue,
            time: State.timeRemaining
        };
        NetworkManager.sendState({
            p1: { x: player1.x, y: player1.y, vx: player1.vx, vy: player1.vy, sprint: player1.isSprinting, charge: player1.charge, stamina: player1.stamina, facing: player1.facingRight, celebrating: player1.celebrating },
            p2: { x: player2.x, y: player2.y, vx: player2.vx, vy: player2.vy, sprint: player2.isSprinting, charge: player2.charge, stamina: player2.stamina, facing: player2.facingRight, celebrating: player2.celebrating },
            ball: { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, color: ball.color },
            scores: scorePack
        });
    }

    if (State.isOnline && State.networkRole === 'client') {
        const localInput = {
            up: keys['KeyW'] || keys['w'] || keys['W'],
            down: keys['KeyS'] || keys['s'] || keys['S'],
            left: keys['KeyA'] || keys['a'] || keys['A'],
            right: keys['KeyD'] || keys['d'] || keys['D'],
            sprint: keys['ShiftLeft'] || keys['Shift'],
            shoot: keys['Space'],
            charge: player2.charge
        };
        NetworkManager.sendInput(localInput);
    }

    requestAnimationFrame(gameLoop);
}

// Networking Event Listeners
window.addEventListener('applyRemoteState', (e) => {
    const s = e.detail;
    player1.x = s.p1.x; player1.y = s.p1.y; player1.vx = s.p1.vx; player1.vy = s.p1.vy;
    player1.isSprinting = s.p1.sprint; player1.charge = s.p1.charge; player1.stamina = s.p1.stamina;
    player1.facingRight = s.p1.facing; player1.celebrating = s.p1.celebrating;

    player2.x = s.p2.x; player2.y = s.p2.y; player2.vx = s.p2.vx; player2.vy = s.p2.vy;
    player2.isSprinting = s.p2.sprint; player2.charge = s.p2.charge; player2.stamina = s.p2.stamina;
    player2.facingRight = s.p2.facing; player2.celebrating = s.p2.celebrating;

    ball.x = s.ball.x; ball.y = s.ball.y; ball.vx = s.ball.vx; ball.vy = s.ball.vy; ball.color = s.ball.color;

    State.scoreRed = s.scores.scoreRed;
    State.scoreBlue = s.scores.scoreBlue;
    State.timeRemaining = s.scores.time;
    updateScoreboard();
    updateTimerDisplay();
});

window.addEventListener('networkReady', () => {
    initGame();
});

document.addEventListener('DOMContentLoaded', () => {
    console.log("Game Initializing via Module...");

    const startBtn = document.getElementById('startBtn');
    const restartBtn = document.getElementById('restartBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const mainMenuBtn = document.getElementById('mainMenuBtn');
    const volumeSlider = document.getElementById('volumeSlider');

    if (startBtn) startBtn.addEventListener('click', initGame);
    if (restartBtn) restartBtn.addEventListener('click', initGame);
    if (resumeBtn) resumeBtn.addEventListener('click', togglePause);

    // Online UI Listeners
    const onlineBtn = document.getElementById('onlineBtn');
    const onlineMenu = document.getElementById('onlineMenu');
    const hostBtn = document.getElementById('hostBtn');
    const joinBtn = document.getElementById('joinBtn');
    const backBtn = document.getElementById('backToMainBtn');
    const joinIdInput = document.getElementById('joinIdInput');
    const myPeerIdEl = document.getElementById('myPeerId');

    if (onlineBtn) onlineBtn.addEventListener('click', () => {
        onlineMenu.classList.remove('hidden');
        NetworkManager.init();
    });

    if (hostBtn) hostBtn.addEventListener('click', () => NetworkManager.host());
    if (joinBtn) joinBtn.addEventListener('click', () => NetworkManager.join(joinIdInput.value));
    if (backBtn) backBtn.addEventListener('click', () => onlineMenu.classList.add('hidden'));

    if (myPeerIdEl) {
        myPeerIdEl.addEventListener('click', () => {
            navigator.clipboard.writeText(myPeerIdEl.innerText);
            alert("Oda kodu kopyalandı!");
        });
    }

    if (mainMenuBtn) {
        mainMenuBtn.addEventListener('click', () => {
            State.gameRunning = false;
            State.gamePaused = false;
            document.getElementById('pauseMenu').classList.add('hidden');

            startScreen.classList.remove('hidden');
            gameOverScreen.classList.add('hidden');

            ctx.clearRect(0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT);
            drawField();
        });
    }

    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            SoundManager.setVolume(e.target.value);
        });
    }

    document.addEventListener('keydown', (e) => {
        if (State.gameRunning && (e.key === 'Escape' || e.key === 'P' || e.key === 'p')) {
            togglePause();
        }
    });

    if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
    }

    drawField();
    player1.draw(ctx);
    player2.draw(ctx);
    ball.draw(ctx);

    console.log("Game Initialized Successfully!");
});
