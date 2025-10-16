// today-game.js - 위기일발! 액션 플랜 (Action Plan for a Crisis!)

// --- Utility Functions ---
function getDailySeed() {
    const today = new Date();
    return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
}

function mulberry32(seed) {
    return function() {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) | 0;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function getRandomValue(base, variance) {
    const min = base - variance;
    const max = base + variance;
    return Math.floor(currentRandFn() * (max - min + 1)) + min;
}

function getEulReParticle(word) {
    if (!word || word.length === 0) return "를";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "를";
    return (uni - 0xAC00) % 28 > 0 ? "을" : "를";
}

function getWaGwaParticle(word) {
    if (!word || word.length === 0) return "와";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "와";
    return (uni - 0xAC00) % 28 > 0 ? "과" : "와";
}

// --- Game State Management ---
let gameState = {};
let currentRandFn = null;

function resetGameState() {
    gameState = {
        day: 1,
        daring: 50, // 대담함
        action: 50, // 행동력
        reputation: 50, // 평판
        agility: 50, // 순발력
        resources: 50, // 자원
        actionPoints: 10,
        maxActionPoints: 10,
        intel: 10,
        gadgets: 10,
        network: 5,
        secret_docs: 0,
        agents: [
            { id: "agent_j", name: "요원 J", personality: "대담한", skill: "정보 분석", loyalty: 70 },
            { id: "agent_k", name: "요원 K", personality: "신중한", skill: "잠입", loyalty: 60 }
        ],
        maxAgents: 5,
        currentScenarioId: "intro",
        lastPlayedDate: new Date().toISOString().slice(0, 10),
        manualDayAdvances: 0,
        dailyEventTriggered: false,
        dailyBonus: { missionSuccess: 0 },
        dailyActions: { patrolled: false, briefingHeld: false, talkedTo: [], minigamePlayed: false },
        equipment: {
            safeHouse: { built: false, durability: 100, name: "안전가옥", description: "요원들의 휴식과 재정비를 위한 공간입니다.", effect_description: "행동력 회복 및 충성도 유지에 도움을 줍니다." },
            gadgetLab: { built: false, durability: 100, name: "장비 개발실", description: "작전에 필요한 특수 장비를 개발합니다.", effect_description: "새로운 장비 개발 및 기존 장비 업그레이드." },
            commandCenter: { built: false, durability: 100, name: "지휘 본부", description: "모든 작전을 총괄하는 지휘 센터입니다.", effect_description: "신규 요원 영입 및 비밀 거래 이벤트 활성화." },
            trainingCenter: { built: false, durability: 100, name: "훈련 센터", description: "요원들의 능력을 향상시키는 훈련 시설입니다.", effect_description: "요원 레벨업을 통한 스탯 및 성공률 증가." },
            vehicleDepot: { built: false, durability: 100, name: "차량기지", description: "작전에 필요한 다양한 이동 수단을 관리합니다.", effect_description: "특수 작전 및 빠른 이동 잠금 해제." }
        },
        agentLevel: 0,
        minigameState: {}
    };
    currentRandFn = mulberry32(getDailySeed() + gameState.day);
}

function saveGameState() {
    localStorage.setItem('estpActionGame', JSON.stringify(gameState));
}

// ... (The rest of the code will be a combination of the old ESTP script and the new ENFJ features, adapted for the ESTP theme)
// This is a placeholder for the full script that will be generated.