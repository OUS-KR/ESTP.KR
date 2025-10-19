// today-game.js - ESTP - 위기일발! 액션 플랜 (Action Plan for a Crisis!)

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
        daring: 50,
        action: 50,
        reputation: 50,
        agility: 50,
        resourcefulness: 50,
        actionPoints: 10,
        maxActionPoints: 10,
        resources: { intel: 10, gadgets: 10, network: 5, secret_docs: 0 },
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
            safeHouse: { built: false, durability: 100, name: "안전가옥" },
            gadgetLab: { built: false, durability: 100, name: "장비 개발실" },
            commandCenter: { built: false, durability: 100, name: "지휘 본부" },
            trainingCenter: { built: false, durability: 100, name: "훈련 센터" },
            vehicleDepot: { built: false, durability: 100, name: "차량기지" }
        },
        agentLevel: 0,
        minigameState: {}
    };
    currentRandFn = mulberry32(getDailySeed() + gameState.day);
}

function saveGameState() {
    localStorage.setItem('estpActionGame', JSON.stringify(gameState));
}

function loadGameState() {
    const savedState = localStorage.getItem('estpActionGame');
    const today = new Date().toISOString().slice(0, 10);
    if (savedState) {
        let loaded = JSON.parse(savedState);
        if (!loaded.dailyBonus) loaded.dailyBonus = { missionSuccess: 0 };
        if (!loaded.equipment) {
            loaded.equipment = {
                safeHouse: { built: false, durability: 100, name: "안전가옥" },
                gadgetLab: { built: false, durability: 100, name: "장비 개발실" },
                commandCenter: { built: false, durability: 100, name: "지휘 본부" },
                trainingCenter: { built: false, durability: 100, name: "훈련 센터" },
                vehicleDepot: { built: false, durability: 100, name: "차량기지" }
            };
        }
        Object.assign(gameState, loaded);

        currentRandFn = mulberry32(getDailySeed() + gameState.day);

        if (gameState.lastPlayedDate !== today) {
            gameState.day += 1;
            gameState.lastPlayedDate = today;
            gameState.manualDayAdvances = 0;
            gameState.dailyEventTriggered = false;
            processDailyEvents();
        }
    } else {
        resetGameState();
        processDailyEvents();
    }
    renderAll();
}

function updateState(changes, displayMessage = null) {
    Object.keys(changes).forEach(key => {
        if (typeof changes[key] === 'object' && changes[key] !== null && !Array.isArray(changes[key])) {
            gameState[key] = { ...gameState[key], ...changes[key] };
        } else {
            gameState[key] = changes[key];
        }
    });
    saveGameState();
    renderAll(displayMessage);
}

// --- UI Rendering ---
function updateGameDisplay(text) {
    const gameArea = document.getElementById('gameArea');
    if(gameArea && text) gameArea.innerHTML = `<p>${text.replace(/\n/g, '<br>')}</p>`;
}

function renderStats() {
    const statsDiv = document.getElementById('gameStats');
    if (!statsDiv) return;
    const agentListHtml = gameState.agents.map(a => `<li>${a.name} (${a.skill}) - 충성도: ${a.loyalty}</li>`).join('');
    statsDiv.innerHTML = `
        <p><b>${gameState.day}일차 작전</b></p>
        <p><b>행동력:</b> ${gameState.actionPoints}/${gameState.maxActionPoints}</p>
        <p><b>대담함:</b> ${gameState.daring} | <b>행동력:</b> ${gameState.action} | <b>평판:</b> ${gameState.reputation} | <b>순발력:</b> ${gameState.agility} | <b>자원 활용:</b> ${gameState.resourcefulness}</p>
        <p><b>자원:</b> 정보 ${gameState.resources.intel}, 장비 ${gameState.resources.gadgets}, 인맥 ${gameState.resources.network}, 비밀 문서 ${gameState.resources.secret_docs || 0}</p>
        <p><b>요원 레벨:</b> ${gameState.agentLevel}</p>
        <p><b>소속 요원 (${gameState.agents.length}/${gameState.maxAgents}):</b></p>
        <ul>${agentListHtml}</ul>
        <p><b>보유 장비:</b></p>
        <ul>${Object.values(gameState.equipment).filter(e => e.built).map(e => `<li>${e.name} (내구성: ${e.durability})</li>`).join('') || '없음'}</ul>
    `;
    const manualDayCounter = document.getElementById('manualDayCounter');
    if(manualDayCounter) manualDayCounter.innerText = gameState.manualDayAdvances;
}

function renderChoices(choices) {
    const choicesDiv = document.getElementById('gameChoices');
    if (!choicesDiv) return;
    let dynamicChoices = [];

    if (gameState.currentScenarioId === 'intro') {
        dynamicChoices = gameScenarios.intro.choices;
    } else if (gameState.currentScenarioId === 'action_equipment_management') {
        dynamicChoices = [];
        if (!gameState.equipment.safeHouse.built) dynamicChoices.push({ text: "안전가옥 구축 (인맥 50, 정보 20)", action: "build_safeHouse" });
        if (!gameState.equipment.gadgetLab.built) dynamicChoices.push({ text: "장비 개발실 구축 (정보 30, 장비 30)", action: "build_gadgetLab" });
        if (!gameState.equipment.commandCenter.built) dynamicChoices.push({ text: "지휘 본부 건설 (인맥 100, 정보 50)", action: "build_commandCenter" });
        if (!gameState.equipment.trainingCenter.built) dynamicChoices.push({ text: "훈련 센터 건설 (정보 80, 장비 40)", action: "build_trainingCenter" });
        if (gameState.equipment.gadgetLab.built && !gameState.equipment.vehicleDepot.built) {
            dynamicChoices.push({ text: "차량기지 확보 (인맥 150, 비밀 문서 5)", action: "build_vehicleDepot" });
        }
        Object.keys(gameState.equipment).forEach(key => {
            const equip = gameState.equipment[key];
            if (equip.built && equip.durability < 100) {
                dynamicChoices.push({ text: `${equip.name} 보수 (정보 10, 장비 10)`, action: "maintain_equipment", params: { equipment: key } });
            }
        });
        dynamicChoices.push({ text: "취소", action: "return_to_intro" });
    } else {
        dynamicChoices = choices ? [...choices] : [];
    }

    choicesDiv.innerHTML = dynamicChoices.map(choice => `<button class="choice-btn" data-action="${choice.action}" data-params='${JSON.stringify(choice.params || {})}' >${choice.text}</button>`).join('');
    choicesDiv.querySelectorAll('.choice-btn').forEach(button => {
        button.addEventListener('click', () => {
            const action = button.dataset.action;
            if (gameActions[action]) {
                gameActions[action](JSON.parse(button.dataset.params || '{}'));
            }
        });
    });
}

function renderAll(customDisplayMessage = null) {
    const desc = document.getElementById('gameDescription');
    if (desc) desc.style.display = 'none';
    renderStats();
    
    if (!gameState.currentScenarioId.startsWith('minigame_')) {
        const scenario = gameScenarios[gameState.currentScenarioId] || gameScenarios.intro;
        updateGameDisplay(customDisplayMessage || scenario.text);
        renderChoices(scenario.choices);
    }
}

// --- Game Data (ESTP Themed) ---
const gameScenarios = {
    "intro": { text: "오늘은 어떤 작전을 수행하시겠습니까?", choices: [
        { text: "정찰", action: "patrol" },
        { text: "요원과 대화", action: "talk_to_agent" },
        { text: "작전 브리핑", action: "hold_briefing" },
        { text: "자원 확보", action: "show_resource_gathering_options" },
        { text: "장비 관리", action: "show_equipment_management_options" },
        { text: "돌발 행동", action: "show_impulsive_actions_options" },
        { text: "오늘의 훈련", action: "play_minigame" }
    ]},
    "action_resource_gathering": {
        text: "어떤 자원을 확보하시겠습니까?",
        choices: [
            { text: "정보 수집", action: "gather_intel" },
            { text: "장비 확보", action: "acquire_gadgets" },
            { text: "인맥 관리", action: "manage_network" },
            { text: "취소", action: "return_to_intro" }
        ]
    },
    "action_equipment_management": { text: "어떤 장비를 관리하시겠습니까?", choices: [] },
    "impulsive_actions_menu": {
        text: "어떤 돌발 행동을 하시겠습니까?",
        choices: [
            { text: "단독 잠입 (행동력 1 소모)", action: "infiltrate_alone" },
            { text: "추격전 (행동력 1 소모)", action: "start_chase" },
            { text: "취소", action: "return_to_intro" }
        ]
    },
    // Game Over Scenarios
    "game_over_daring": { text: "지나친 대담함이 화를 불렀습니다. 작전은 실패하고 당신은 제거됩니다.", choices: [], final: true },
    "game_over_action": { text: "행동력이 부족하여 위기에서 탈출하지 못했습니다.", choices: [], final: true },
    "game_over_reputation": { text: "조직의 평판을 모두 잃었습니다. 당신은 해고되었습니다.", choices: [], final: true },
    "game_over_resources": { text: "작전에 필요한 자원이 모두 소진되었습니다.", choices: [], final: true },
};

const patrolOutcomes = [
    { weight: 30, condition: (gs) => gs.agility > 60, effect: (gs) => { const v = getRandomValue(10, 5); return { changes: { action: gs.action + v }, message: `뛰어난 순발력으로 적의 동태를 완벽하게 파악했습니다! (+${v} 행동력)` }; } },
    { weight: 25, condition: () => true, effect: (gs) => { const v = getRandomValue(5, 2); return { changes: { reputation: gs.reputation + v }, message: `성공적인 정찰로 조직 내 평판이 상승했습니다. (+${v} 평판)` }; } },
    { weight: 20, condition: () => true, effect: (gs) => { const v = getRandomValue(5, 2); return { changes: { resources: { ...gs.resources, gadgets: gs.resources.gadgets - v } }, message: `정찰 중 실수로 장비를 분실했습니다. (-${v} 장비)` }; } },
    { weight: 15, condition: (gs) => gs.agility < 40, effect: (gs) => { const v = getRandomValue(5, 2); return { changes: { daring: gs.daring - v }, message: `순발력이 부족하여 위험에 노출되었습니다. (-${v} 대담함)` }; } },
];

const talkOutcomes = [
    { weight: 40, condition: (gs, agent) => agent.loyalty < 80, effect: (gs, agent) => { const v = getRandomValue(10, 5); const updated = gs.agents.map(a => a.id === agent.id ? { ...a, loyalty: Math.min(100, a.loyalty + v) } : a); return { changes: { agents: updated }, message: `${agent.name}${getWaGwaParticle(agent.name)}의 솔직한 대화로 충성도가 상승했습니다. (+${v} 충성도)` }; } },
    { weight: 30, condition: () => true, effect: (gs, agent) => { const v = getRandomValue(5, 2); return { changes: { resourcefulness: gs.resourcefulness + v }, message: `${agent.name}에게서 유용한 정보를 얻었습니다. (+${v} 자원 활용)` }; } },
    { weight: 20, condition: (gs) => gs.reputation < 40, effect: (gs, agent) => { const v = getRandomValue(10, 3); const updated = gs.agents.map(a => a.id === agent.id ? { ...a, loyalty: Math.max(0, a.loyalty - v) } : a); return { changes: { agents: updated }, message: `당신의 낮은 평판에 ${agent.name}이(가) 불신을 표합니다. (-${v} 충성도)` }; } },
];

const briefingOutcomes = [
    { weight: 40, condition: (gs) => gs.action > 60, effect: (gs) => { const v = getRandomValue(10, 3); return { changes: { daring: gs.daring + v }, message: `완벽한 작전 브리핑으로 요원들의 대담함이 상승합니다. (+${v} 대담함)` }; } },
    { weight: 30, condition: () => true, effect: (gs) => { const v = getRandomValue(10, 3); return { changes: { reputation: gs.reputation + v }, message: `브리핑을 통해 당신의 리더십을 증명했습니다. (+${v} 평판)` }; } },
    { weight: 20, condition: (gs) => gs.resourcefulness < 40, effect: (gs) => { const v = getRandomValue(10, 4); return { changes: { agility: gs.agility - v }, message: `자원 활용 계획이 미흡하여 작전의 순발력이 떨어집니다. (-${v} 순발력)` }; } },
];

const minigames = [
    {
        name: "순발력 테스트",
        description: "화면에 나타나는 목표를 최대한 빠르게 클릭하세요!",
        start: (gameArea, choicesDiv) => {
            gameState.minigameState = { score: 0, targets: 5, startTime: Date.now() };
            minigames[0].render(gameArea, choicesDiv);
        },
        render: (gameArea, choicesDiv) => {
            const state = gameState.minigameState;
            gameArea.innerHTML = `<p>${minigames[0].description}</p><div id="target-area" style="position: relative; width: 100%; height: 200px; border: 1px solid #fff;"></div>`;
            choicesDiv.innerHTML = ``;
            if (state.targets > 0) {
                const target = document.createElement('div');
                target.style.position = 'absolute';
                target.style.width = '30px';
                target.style.height = '30px';
                target.style.borderRadius = '50%';
                target.style.backgroundColor = 'red';
                target.style.left = `${currentRandFn() * 90}%`;
                target.style.top = `${currentRandFn() * 90}%`;
                target.addEventListener('click', () => minigames[0].processAction('click_target'));
                document.getElementById('target-area').appendChild(target);
            }
        },
        processAction: (actionType) => {
            if (actionType === 'click_target') {
                const state = gameState.minigameState;
                state.targets--;
                state.score += 10;
                if (state.targets <= 0) {
                    const timeTaken = (Date.now() - state.startTime) / 1000;
                    state.score += Math.max(0, 100 - (timeTaken * 10)); // Bonus for speed
                    minigames[0].end();
                } else {
                    minigames[0].render(document.getElementById('gameArea'), document.getElementById('gameChoices'));
                }
            }
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[0].name, gameState.minigameState.score);
            updateState({ agility: gameState.agility + rewards.agility, action: gameState.action + rewards.action, currentScenarioId: 'intro' }, rewards.message);
        }
    },
];

function calculateMinigameReward(minigameName, score) {
    let rewards = { agility: 0, action: 0, message: "" };
    if (score >= 100) { rewards.agility = 15; rewards.action = 10; rewards.message = "최고의 순발력입니다! (+15 순발력, +10 행동력)"; } 
    else if (score >= 50) { rewards.agility = 10; rewards.action = 5; rewards.message = "빠른 반응 속도입니다. (+10 순발력, +5 행동력)"; } 
    else { rewards.agility = 5; rewards.message = "훈련을 완료했습니다. (+5 순발력)"; }
    return rewards;
}

function spendActionPoint() {
    if (gameState.actionPoints <= 0) { updateGameDisplay("행동력이 부족합니다."); return false; }
    updateState({ actionPoints: gameState.actionPoints - 1 });
    return true;
}

const gameActions = {
    patrol: () => {
        if (!spendActionPoint()) return;
        const possibleOutcomes = patrolOutcomes.filter(o => !o.condition || o.condition(gameState));
        const totalWeight = possibleOutcomes.reduce((sum, o) => sum + o.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(o => (cumulativeWeight += o.weight) >= rand) || possibleOutcomes[0];
        const result = chosenOutcome.effect(gameState);
        updateState(result.changes, result.message);
    },
    talk_to_agent: () => {
        if (!spendActionPoint()) return;
        const agent = gameState.agents[Math.floor(currentRandFn() * gameState.agents.length)];
        const possibleOutcomes = talkOutcomes.filter(o => !o.condition || o.condition(gameState, agent));
        const totalWeight = possibleOutcomes.reduce((sum, o) => sum + o.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(o => (cumulativeWeight += o.weight) >= rand) || possibleOutcomes[0];
        const result = chosenOutcome.effect(gameState, agent);
        updateState(result.changes, result.message);
    },
    hold_briefing: () => {
        if (!spendActionPoint()) return;
        const possibleOutcomes = briefingOutcomes.filter(o => !o.condition || o.condition(gameState));
        const totalWeight = possibleOutcomes.reduce((sum, o) => sum + o.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(o => (cumulativeWeight += o.weight) >= rand) || possibleOutcomes[0];
        const result = chosenOutcome.effect(gameState);
        updateState(result.changes, result.message);
    },
    show_resource_gathering_options: () => updateState({ currentScenarioId: 'action_resource_gathering' }),
    show_equipment_management_options: () => updateState({ currentScenarioId: 'action_equipment_management' }),
    show_impulsive_actions_options: () => updateState({ currentScenarioId: 'impulsive_actions_menu' }),
    gather_intel: () => {
        if (!spendActionPoint()) return;
        const gain = getRandomValue(10, 4);
        updateState({ resources: { ...gameState.resources, intel: gameState.resources.intel + gain } }, `정보를 수집했습니다. (+${gain} 정보)`);
    },
    acquire_gadgets: () => {
        if (!spendActionPoint()) return;
        const gain = getRandomValue(10, 4);
        updateState({ resources: { ...gameState.resources, gadgets: gameState.resources.gadgets + gain } }, `장비를 확보했습니다. (+${gain} 장비)`);
    },
    manage_network: () => {
        if (!spendActionPoint()) return;
        const gain = getRandomValue(5, 2);
        updateState({ resources: { ...gameState.resources, network: gameState.resources.network + gain } }, `인맥을 관리했습니다. (+${gain} 인맥)`);
    },
    build_safeHouse: () => {
        if (!spendActionPoint()) return;
        const cost = { network: 50, intel: 20 };
        if (gameState.resources.network >= cost.network && gameState.resources.intel >= cost.intel) {
            gameState.equipment.safeHouse.built = true;
            const v = getRandomValue(10, 3);
            updateState({ agility: gameState.agility + v, resources: { ...gameState.resources, network: gameState.resources.network - cost.network, intel: gameState.resources.intel - cost.intel } }, `안전가옥을 구축했습니다! (+${v} 순발력)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_gadgetLab: () => {
        if (!spendActionPoint()) return;
        const cost = { intel: 30, gadgets: 30 };
        if (gameState.resources.intel >= cost.intel && gameState.resources.gadgets >= cost.gadgets) {
            gameState.equipment.gadgetLab.built = true;
            const v = getRandomValue(10, 3);
            updateState({ resourcefulness: gameState.resourcefulness + v, resources: { ...gameState.resources, intel: gameState.resources.intel - cost.intel, gadgets: gameState.resources.gadgets - cost.gadgets } }, `장비 개발실을 구축했습니다! (+${v} 자원 활용)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_commandCenter: () => {
        if (!spendActionPoint()) return;
        const cost = { network: 100, intel: 50 };
        if (gameState.resources.network >= cost.network && gameState.resources.intel >= cost.intel) {
            gameState.equipment.commandCenter.built = true;
            const v = getRandomValue(15, 5);
            updateState({ reputation: gameState.reputation + v, resources: { ...gameState.resources, network: gameState.resources.network - cost.network, intel: gameState.resources.intel - cost.intel } }, `지휘 본부를 건설했습니다! (+${v} 평판)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_trainingCenter: () => {
        if (!spendActionPoint()) return;
        const cost = { intel: 80, gadgets: 40 };
        if (gameState.resources.intel >= cost.intel && gameState.resources.gadgets >= cost.gadgets) {
            gameState.equipment.trainingCenter.built = true;
            const v = getRandomValue(15, 5);
            updateState({ action: gameState.action + v, resources: { ...gameState.resources, intel: gameState.resources.intel - cost.intel, gadgets: gameState.resources.gadgets - cost.gadgets } }, `훈련 센터를 건설했습니다! (+${v} 행동력)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_vehicleDepot: () => {
        if (!spendActionPoint()) return;
        const cost = { network: 150, secret_docs: 5 };
        if (gameState.resources.network >= cost.network && gameState.resources.secret_docs >= cost.secret_docs) {
            gameState.equipment.vehicleDepot.built = true;
            const v = getRandomValue(20, 5);
            updateState({ daring: gameState.daring + v, resources: { ...gameState.resources, network: gameState.resources.network - cost.network, secret_docs: gameState.resources.secret_docs - cost.secret_docs } }, `차량기지를 확보했습니다! (+${v} 대담함)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    maintain_equipment: (params) => {
        if (!spendActionPoint()) return;
        const equipKey = params.equipment;
        const cost = { intel: 10, gadgets: 10 };
        if (gameState.resources.intel >= cost.intel && gameState.resources.gadgets >= cost.gadgets) {
            gameState.equipment[equipKey].durability = 100;
            updateState({ resources: { ...gameState.resources, intel: gameState.resources.intel - cost.intel, gadgets: gameState.resources.gadgets - cost.gadgets } }, `${gameState.equipment[equipKey].name}을(를) 보수했습니다.`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    infiltrate_alone: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        if (rand < 0.3) {
            const v = getRandomValue(1, 1);
            updateState({ resources: { ...gameState.resources, secret_docs: (gameState.resources.secret_docs || 0) + v } }, `단독 잠입 중 비밀 문서를 발견했습니다! (+${v} 비밀 문서)`);
        } else {
            const v = getRandomValue(10, 5);
            updateState({ daring: gameState.daring + v }, `성공적으로 잠입하여 대담함이 상승했습니다. (+${v} 대담함)`);
        }
    },
    start_chase: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        if (rand < 0.6) {
            const v = getRandomValue(10, 5);
            updateState({ agility: gameState.agility + v }, `추격전에서 승리하여 순발력이 상승했습니다. (+${v} 순발력)`);
        } else {
            updateState({}, `추격전에서 아슬아슬하게 벗어났습니다.`);
        }
    },
    play_minigame: () => {
        if (!spendActionPoint()) return;
        const minigame = minigames[0];
        gameState.currentScenarioId = `minigame_${minigame.name}`;
        updateState({ dailyActions: { ...gameState.dailyActions, minigamePlayed: true } });
        updateGameDisplay(minigame.description);
        minigame.start(document.getElementById('gameArea'), document.getElementById('gameChoices'));
    },
    return_to_intro: () => updateState({ currentScenarioId: 'intro' }),
    manualNextDay: () => {
        if (gameState.manualDayAdvances >= 5) { updateGameDisplay("오늘은 더 이상 다음 날로 넘어갈 수 없습니다."); return; }
        updateState({
            manualDayAdvances: gameState.manualDayAdvances + 1,
            day: gameState.day + 1,
            dailyEventTriggered: false
        });
        processDailyEvents();
    },
};

function applyStatEffects() {
    let message = "";
    if (gameState.daring >= 70) { message += "대담한 행동으로 작전 성공률이 증가합니다. "; }
    if (gameState.action >= 70) { const v = getRandomValue(5, 2); gameState.resources.intel += v; message += `뛰어난 행동력으로 추가 정보를 획득합니다. (+${v} 정보) `; }
    if (gameState.reputation >= 70) { const v = getRandomValue(2, 1); gameState.agents.forEach(a => a.loyalty = Math.min(100, a.loyalty + v)); message += `높은 평판 덕분에 요원들의 충성도가 상승합니다. (+${v} 충성도) `; }
    if (gameState.agility < 30) { gameState.actionPoints -= 1; message += "순발력이 떨어져 행동력이 1 감소합니다. "; }
    if (gameState.resourcefulness < 30) { Object.keys(gameState.equipment).forEach(key => { if(gameState.equipment[key].built) gameState.equipment[key].durability -= 1; }); message += "자원 활용 능력이 부족하여 장비가 노후화됩니다. "; }
    return message;
}

const weightedDailyEvents = [
    { id: "enemy_ambush", weight: 10, condition: () => gameState.agility < 40, onTrigger: () => { const v = getRandomValue(10, 3); updateState({ daring: gameState.daring - v, action: gameState.action - v }, `적의 매복에 당했습니다. (-${v} 대담함, -${v} 행동력)`); } },
    { id: "gadget_malfunction", weight: 5, condition: () => true, onTrigger: () => { const v = getRandomValue(15, 5); updateState({ resources: { ...gameState.resources, gadgets: Math.max(0, gameState.resources.gadgets - v) }, reputation: gameState.reputation - 5 }, `장비 오작동으로 작전에 차질이 생겼습니다. (-${v} 장비, -5 평판)`); } },
    { id: "new_intel", weight: 15, condition: () => true, onTrigger: () => { const v = getRandomValue(10, 5); updateState({ resourcefulness: gameState.resourcefulness + v }, `새로운 정보원을 확보했습니다! (+${v} 자원 활용)`); } },
];

function processDailyEvents() {
    if (gameState.dailyEventTriggered) return;
    currentRandFn = mulberry32(getDailySeed() + gameState.day);
    updateState({ actionPoints: 10, dailyEventTriggered: true });
    const statEffectMessage = applyStatEffects();
    let dailyMessage = "새로운 작전의 날이 밝았습니다. " + statEffectMessage;

    if (gameState.daring <= 0) { gameState.currentScenarioId = "game_over_daring"; }
    else if (gameState.action <= 0) { gameState.currentScenarioId = "game_over_action"; }
    else if (gameState.reputation <= 0) { gameState.currentScenarioId = "game_over_reputation"; }
    else if (gameState.resources.intel <= 0 && gameState.day > 1) { gameState.currentScenarioId = "game_over_resources"; }

    let eventId = "intro";
    const possibleEvents = weightedDailyEvents.filter(event => !event.condition || event.condition());
    if (possibleEvents.length > 0) {
        const totalWeight = possibleEvents.reduce((sum, event) => sum + event.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenEvent = possibleEvents.find(event => (cumulativeWeight += event.weight) >= rand);
        if (chosenEvent) {
            eventId = chosenEvent.id;
            if (chosenEvent.onTrigger) chosenEvent.onTrigger();
        }
    }
    if (!gameScenarios[gameState.currentScenarioId]) {
        gameState.currentScenarioId = eventId;
    }
    updateGameDisplay(dailyMessage + (gameScenarios[gameState.currentScenarioId]?.text || ''));
    renderChoices(gameScenarios[gameState.currentScenarioId]?.choices || []);
    saveGameState();
}

function initDailyGame() {
    loadGameState();
}

function resetGame() {
    if (confirm("정말로 모든 작전을 포기하시겠습니까? 모든 정보가 사라집니다.")) {
        localStorage.removeItem('estpActionGame');
        resetGameState();
        saveGameState();
        location.reload();
    }
}

window.onload = function() {
    try {
        initDailyGame();
        document.getElementById('resetGameBtn').addEventListener('click', resetGame);
        document.getElementById('nextDayBtn').addEventListener('click', gameActions.manualNextDay);
    } catch (e) {
        console.error("오늘의 게임 생성 중 오류 발생:", e);
        document.getElementById('gameDescription').innerText = "콘텐츠를 불러오는 데 실패했습니다. 페이지를 새로고침해 주세요.";
    }
};
