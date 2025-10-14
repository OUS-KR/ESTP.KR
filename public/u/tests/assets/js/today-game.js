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

function getEulReParticle(word) {
    if (!word || word.length === 0) return "";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "를";
    return (uni - 0xAC00) % 28 > 0 ? "을" : "를";
}

function getWaGwaParticle(word) {
    if (!word || word.length === 0) return "";
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
            safeHouse: { built: false, durability: 100 },
            gadgetLab: { built: false, durability: 100 },
            commandCenter: { built: false, durability: 100 },
            trainingCenter: { built: false, durability: 100 },
            vehicleDepot: { built: false, durability: 100 }
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
        if (!loaded.agents || loaded.agents.length === 0) {
            loaded.agents = [
                { id: "agent_j", name: "요원 J", personality: "대담한", skill: "정보 분석", loyalty: 70 },
                { id: "agent_k", name: "요원 K", personality: "신중한", skill: "잠입", loyalty: 60 }
            ];
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
        <p><b>작전일:</b> ${gameState.day}일차</p>
        <p><b>행동력:</b> ${gameState.actionPoints}/${gameState.maxActionPoints}</p>
        <p><b>대담함:</b> ${gameState.daring} | <b>행동력:</b> ${gameState.action} | <b>평판:</b> ${gameState.reputation}</p>
        <p><b>자원:</b> 정보 ${gameState.resources.intel}, 장비 ${gameState.resources.gadgets}, 인맥 ${gameState.resources.network}, 비밀 문서 ${gameState.resources.secret_docs || 0}</p>
        <p><b>요원 레벨:</b> ${gameState.agentLevel}</p>
        <p><b>팀원 (${gameState.agents.length}/${gameState.maxAgents}):</b></p>
        <ul>${agentListHtml}</ul>
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
    } else if (gameState.currentScenarioId === 'action_facility_management') {
        dynamicChoices = gameScenarios.action_facility_management.choices ? [...gameScenarios.action_facility_management.choices] : [];
        if (!gameState.equipment.safeHouse.built) dynamicChoices.push({ text: "안전가옥 확보 (정보 50, 인맥 20)", action: "build_safe_house" });
        if (!gameState.equipment.gadgetLab.built) dynamicChoices.push({ text: "장비 개발실 구축 (장비 30, 인맥 30)", action: "build_gadget_lab" });
        if (!gameState.equipment.commandCenter.built) dynamicChoices.push({ text: "지휘 본부 설립 (정보 100, 장비 50, 인맥 50)", action: "build_command_center" });
        if (!gameState.equipment.trainingCenter.built) dynamicChoices.push({ text: "훈련 센터 설립 (장비 80, 인맥 40)", action: "build_training_center" });
        if (gameState.equipment.gadgetLab.built && gameState.equipment.gadgetLab.durability > 0 && !gameState.equipment.vehicleDepot.built) {
            dynamicChoices.push({ text: "차량기지 확보 (장비 50, 인맥 100)", action: "build_vehicle_depot" });
        }
        Object.keys(gameState.equipment).forEach(key => {
            const facility = gameState.equipment[key];
            if (facility.built && facility.durability < 100) {
                dynamicChoices.push({ text: `${key} 보수 (장비 10, 인맥 10)`, action: "maintain_facility", params: { facility: key } });
            }
        });
        dynamicChoices.push({ text: "취소", action: "return_to_intro" });
    } else {
        dynamicChoices = choices ? [...choices] : [];
    }

    choicesDiv.innerHTML = dynamicChoices.map(choice => `<button class="choice-btn" data-action="${choice.action}" data-params='${JSON.stringify(choice.params || {})}'''>${choice.text}</button>`).join('');
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

// --- Game Data ---
const gameScenarios = {
    "intro": { text: "오늘의 작전은 무엇입니까?", choices: [
        { text: "정찰 활동", action: "patrol" },
        { text: "팀원과 대화", action: "talk_to_agents" },
        { text: "작전 브리핑", action: "hold_briefing" },
        { text: "자원 확보", action: "show_resource_collection_options" },
        { text: "장비 관리", action: "show_facility_options" },
        { text: "오늘의 미니게임", action: "play_minigame" }
    ]},
    "daily_event_betrayal": {
        text: "팀 내에 배신자가 있는 것 같습니다. 정보가 새어나가고 있습니다. 어떻게 하시겠습니까?",
        choices: [
            { text: "요원 J를 심문한다.", action: "handle_betrayal", params: { first: "agent_j", second: "agent_k" } },
            { text: "요원 K를 심문한다.", action: "handle_betrayal", params: { first: "agent_k", second: "agent_j" } },
            { text: "함정을 파서 배신자를 색출한다.", action: "mediate_betrayal" },
            { text: "일단 지켜본다.", action: "ignore_event" }
        ]
    },
    "daily_event_ambush": { text: "적의 기습 공격으로 보유 장비 일부를 잃었습니다. (-10 장비)", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_misinformation": { text: "잘못된 정보로 인해 작전이 실패했습니다. (-10 정보)", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_ally": {
        text: "우호적인 조직에서 비밀 거래를 제안했습니다. [인맥 50]을 사용하여 [비밀 문서]를 얻을 수 있습니다.",
        choices: [
            { text: "거래한다", action: "accept_deal" },
            { text: "거절한다", action: "decline_deal" }
        ]
    },
    "daily_event_new_agent": {
        choices: [
            { text: "실력을 보고 즉시 영입한다.", action: "welcome_new_unique_agent" },
            { text: "팀워크를 위해 기존 요원들의 의견을 듣는다.", action: "observe_agent" },
            { text: "위험인물일 수 있다. 거절한다.", action: "reject_agent" }
        ]
    },
    "game_over_daring": { text: "대담함이 부족하여 결정적인 순간에 행동하지 못했습니다. 작전은 실패했습니다.", choices: [], final: true },
    "game_over_action": { text: "행동력이 부족하여 더 이상 작전을 수행할 수 없습니다.", choices: [], final: true },
    "game_over_reputation": { text: "조직의 평판이 최악입니다. 모든 지원이 끊겼습니다.", choices: [], final: true },
    "game_over_resources": { text: "자원이 모두 고갈되어 조직을 운영할 수 없습니다.", choices: [], final: true },
    "action_resource_collection": {
        text: "어떤 자원을 확보하시겠습니까?",
        choices: [
            { text: "정보 수집 (정보)", action: "perform_gather_intel" },
            { text: "장비 제작 (장비)", action: "perform_craft_gadgets" },
            { text: "인맥 관리 (인맥)", "action": "perform_manage_network" },
            { text: "취소", "action": "return_to_intro" }
        ]
    },
    "action_facility_management": {
        text: "어떤 장비를 관리하시겠습니까?",
        choices: []
    },
    "resource_collection_result": {
        text: "",
        choices: [{ text: "확인", action: "show_resource_collection_options" }]
    },
    "facility_management_result": {
        text: "",
        choices: [{ text: "확인", action: "show_facility_options" }]
    },
    "betrayal_resolution_result": {
        text: "",
        choices: [{ text: "확인", action: "return_to_intro" }]
    }
};

function calculateMinigameReward(minigameName, score) {
    let rewards = { daring: 0, action: 0, reputation: 0, message: "" };

    switch (minigameName) {
        case "기억력 순서 맞추기":
            if (score >= 51) {
                rewards.action = 15;
                rewards.daring = 10;
                rewards.reputation = 5;
                rewards.message = `완벽한 기억력입니다! 모든 암호를 기억했습니다. (+15 행동력, +10 대담함, +5 평판)`;
            } else if (score >= 21) {
                rewards.action = 10;
                rewards.daring = 5;
                rewards.message = `훌륭한 기억력입니다. (+10 행동력, +5 대담함)`;
            } else if (score >= 0) {
                rewards.action = 5;
                rewards.message = `훈련을 완료했습니다. (+5 행동력)`;
            } else {
                rewards.message = `훈련을 완료했지만, 아쉽게도 보상은 없습니다.`;
            }
            break;
        case "순발력 테스트":
            rewards.daring = 10;
            rewards.message = `엄청난 순발력입니다! (+10 대담함)`;
            break;
        case "위기 협상":
            rewards.reputation = 10;
            rewards.message = `성공적인 협상으로 조직의 평판이 올랐습니다. (+10 평판)`;
            break;
        case "잠입 액션":
            rewards.daring = 5;
            rewards.action = 5;
            rewards.message = `성공적으로 잠입했습니다! (+5 대담함, +5 행동력)`;
            break;
        case "해킹 챌린지":
            rewards.daring = 10;
            rewards.reputation = 5;
            rewards.message = `적의 시스템을 해킹했습니다! (+10 대담함, +5 평판)`;
            break;
        default:
            rewards.message = `미니게임 ${minigameName}을(를) 완료했습니다.`;
            break;
    }
    return rewards;
}

const minigames = [
    {
        name: "기억력 순서 맞추기",
        description: "화면에 나타나는 암호 순서를 기억하고 정확하게 입력하세요. 단계가 올라갈수록 어려워집니다!",
        start: (gameArea, choicesDiv) => {
            gameState.minigameState = { currentSequence: [], playerInput: [], stage: 1, score: 0, showingSequence: false };
            minigames[0].render(gameArea, choicesDiv);
            minigames[0].showSequence();
        },
        render: (gameArea, choicesDiv) => {
            gameArea.innerHTML = `
                <p><b>단계:</b> ${gameState.minigameState.stage} | <b>점수:</b> ${gameState.minigameState.score}</p>
                <p id="sequenceDisplay" style="font-size: 2em; font-weight: bold; min-height: 1.5em;"></p>
                <p>순서를 기억하고 입력하세요:</p>
                <div id="playerInputDisplay" style="font-size: 1.5em; min-height: 1.5em;">${gameState.minigameState.playerInput.join(' ')}</div>
            `;
            choicesDiv.innerHTML = `
                <div class="number-pad">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `<button class="choice-btn num-btn" data-value="${num}">${num}</button>`).join('')}
                    <button class="choice-btn num-btn" data-value="0">0</button>
                    <button class="choice-btn submit-btn" data-action="submitSequence">입력 완료</button>
                    <button class="choice-btn reset-btn" data-action="resetInput">초기화</button>
                </div>
            `;
            choicesDiv.querySelectorAll('.num-btn').forEach(button => {
                button.addEventListener('click', () => minigames[0].processAction('addInput', button.dataset.value));
            });
            choicesDiv.querySelector('.submit-btn').addEventListener('click', () => minigames[0].processAction('submitSequence'));
            choicesDiv.querySelector('.reset-btn').addEventListener('click', () => minigames[0].processAction('resetInput'));
        },
        showSequence: () => {
            gameState.minigameState.showingSequence = true;
            gameState.minigameState.currentSequence = [];
            const sequenceLength = gameState.minigameState.stage + 2;
            for (let i = 0; i < sequenceLength; i++) {
                gameState.minigameState.currentSequence.push(Math.floor(currentRandFn() * 10));
            }

            const sequenceDisplay = document.getElementById('sequenceDisplay');
            let i = 0;
            const interval = setInterval(() => {
                if (i < gameState.minigameState.currentSequence.length) {
                    sequenceDisplay.innerText = gameState.minigameState.currentSequence[i];
                    i++;
                } else {
                    clearInterval(interval);
                    sequenceDisplay.innerText = "입력하세요!";
                    gameState.minigameState.showingSequence = false;
                }
            }, 800);
        },
        processAction: (actionType, value = null) => {
            if (gameState.minigameState.showingSequence) return;

            if (actionType === 'addInput') {
                gameState.minigameState.playerInput.push(parseInt(value));
                document.getElementById('playerInputDisplay').innerText = gameState.minigameState.playerInput.join(' ');
            } else if (actionType === 'resetInput') {
                gameState.minigameState.playerInput = [];
                document.getElementById('playerInputDisplay').innerText = '';
            } else if (actionType === 'submitSequence') {
                const correct = gameState.minigameState.currentSequence.every((num, i) => num === gameState.minigameState.playerInput[i]);

                if (correct && gameState.minigameState.playerInput.length === gameState.minigameState.currentSequence.length) {
                    gameState.minigameState.score += gameState.minigameState.currentSequence.length * 10;
                    gameState.minigameState.stage++;
                    gameState.minigameState.playerInput = [];
                    updateGameDisplay("정답입니다! 다음 단계로 넘어갑니다.");
                    minigames[0].render(document.getElementById('gameArea'), document.getElementById('gameChoices'));
                    setTimeout(() => minigames[0].showSequence(), 1500);
                } else {
                    updateGameDisplay("오답입니다. 게임 종료.");
                    minigames[0].end();
                }
            }
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[0].name, gameState.minigameState.score);
            updateState({
                daring: gameState.daring + rewards.daring,
                action: gameState.action + rewards.action,
                reputation: gameState.reputation + rewards.reputation,
                currentScenarioId: 'intro'
            }, rewards.message);
            gameState.minigameState = {};
        }
    },
    { name: "순발력 테스트", description: "돌발 상황에 빠르게 대처하여 위기를 극복하세요.", start: (ga, cd) => { ga.innerHTML = "<p>순발력 테스트 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[1].end()'>종료</button>"; gameState.minigameState = { score: 10 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[1].name, gameState.minigameState.score); updateState({ daring: gameState.daring + r.daring, action: gameState.action + r.action, reputation: gameState.reputation + r.reputation, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "위기 협상", description: "제한 시간 안에 상대방을 설득하여 최상의 결과를 이끌어내세요.", start: (ga, cd) => { ga.innerHTML = "<p>위기 협상 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[2].end()'>종료</button>"; gameState.minigameState = { score: 15 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[2].name, gameState.minigameState.score); updateState({ daring: gameState.daring + r.daring, action: gameState.action + r.action, reputation: gameState.reputation + r.reputation, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "잠입 액션", description: "적의 눈을 피해 목표 지점까지 잠입하세요.", start: (ga, cd) => { ga.innerHTML = "<p>잠입 액션 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigame[3].end()'>종료</button>"; gameState.minigameState = { score: 20 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[3].name, gameState.minigameState.score); updateState({ daring: gameState.daring + r.daring, action: gameState.action + r.action, reputation: gameState.reputation + r.reputation, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "해킹 챌린지", description: "제한 시간 안에 적의 보안 시스템을 해킹하세요.", start: (ga, cd) => { ga.innerHTML = "<p>해킹 챌린지 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[4].end()'>종료</button>"; gameState.minigameState = { score: 25 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[4].name, gameState.minigameState.score); updateState({ daring: gameState.daring + r.daring, action: gameState.action + r.action, reputation: gameState.reputation + r.reputation, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } }
];

// --- Game Actions ---
function spendActionPoint() {
    if (gameState.actionPoints <= 0) {
        updateGameDisplay("행동력이 부족합니다.");
        return false;
    }
    updateState({ actionPoints: gameState.actionPoints - 1 });
    return true;
}

const gameActions = {
    patrol: () => {
        if (!spendActionPoint()) return;
        if (gameState.dailyActions.patrolled) { updateState({ dailyActions: { ...gameState.dailyActions, patrolled: true } }, "오늘은 이미 모든 구역을 정찰했습니다."); return; }
        
        let changes = { dailyActions: { ...gameState.dailyActions, patrolled: true } };
        let message = "담당 구역을 정찰했습니다.";
        const rand = currentRandFn();
        if (rand < 0.3) { message += " 적의 동향에 대한 정보를 입수했습니다. (+2 정보)"; changes.resources = { ...gameState.resources, intel: gameState.resources.intel + 2 }; }
        else if (rand < 0.6) { message += " 유용한 장비를 발견했습니다. (+2 장비)"; changes.resources = { ...gameState.resources, gadgets: gameState.resources.gadgets + 2 }; }
        else { message += " 특별한 것은 발견하지 못했습니다."; }
        
        updateState(changes, message);
    },
    talk_to_agents: () => {
        if (!spendActionPoint()) return;
        const agent = gameState.agents[Math.floor(currentRandFn() * gameState.agents.length)];
        if (gameState.dailyActions.talkedTo.includes(agent.id)) { updateState({ dailyActions: { ...gameState.dailyActions, talkedTo: [...gameState.dailyActions.talkedTo, agent.id] } }, `${agent.name}${getWaGwaParticle(agent.name)} 이미 대화했습니다.`); return; }
        
        let changes = { dailyActions: { ...gameState.dailyActions, talkedTo: [...gameState.dailyActions.talkedTo, agent.id] } };
        let message = `${agent.name}${getWaGwaParticle(agent.name)} 대화했습니다. `;
        if (agent.loyalty > 80) { message += "그는 당신에게 절대적인 충성을 맹세하며 조직의 평판을 높였습니다. (+5 평판)"; changes.reputation = gameState.reputation + 5; }
        else if (agent.loyalty < 40) { message += "그는 당신의 계획에 의구심을 품고 있습니다. (-5 행동력)"; changes.action = gameState.action - 5; }
        else { message += "그와의 대화를 통해 작전 계획을 점검했습니다. (+2 행동력)"; changes.action = gameState.action + 2; }
        
        updateState(changes, message);
    },
    hold_briefing: () => {
        if (!spendActionPoint()) return;
        if (gameState.dailyActions.briefingHeld) {
            const message = "오늘은 이미 작전 브리핑을 진행했습니다. (-5 평판)";
            gameState.reputation -= 5;
            updateState({ reputation: gameState.reputation }, message);
            return;
        }
        updateState({ dailyActions: { ...gameState.dailyActions, briefingHeld: true } });
        const rand = currentRandFn();
        let message = "작전 브리핑을 진행했습니다. ";
        if (rand < 0.5) { message += "팀원들의 사기가 올랐습니다. (+10 행동력, +5 평판)"; updateState({ action: gameState.action + 10, reputation: gameState.reputation + 5 }); }
        else { message += "브리핑 중 작은 실수가 있었지만, 당신의 순발력으로 무사히 넘어갔습니다. (+5 대담함)"; updateState({ daring: gameState.daring + 5 }); }
        updateGameDisplay(message);
    },
    manualNextDay: () => {
        if (gameState.manualDayAdvances >= 5) { updateGameDisplay("오늘은 더 이상 수동으로 날짜를 넘길 수 없습니다. 내일 다시 시도해주세요."); return; }
        updateState({
            manualDayAdvances: gameState.manualDayAdvances + 1,
            day: gameState.day + 1,
            lastPlayedDate: new Date().toISOString().slice(0, 10),
            dailyEventTriggered: false
        });
        processDailyEvents();
    },
    handle_betrayal: (params) => {
        if (!spendActionPoint()) return;
        const { first, second } = params;
        let message = "";
        let reward = { daring: 0, action: 0, reputation: 0 };
        
        const updatedAgents = gameState.agents.map(a => {
            if (a.id === first) {
                a.loyalty = Math.max(0, a.loyalty - 15);
                message += `${a.name}을(를) 심문했지만, 그는 결백을 주장합니다. 그의 충성도가 크게 하락했습니다. `;
                reward.reputation -= 5;
            } else if (a.id === second) {
                a.loyalty = Math.min(100, a.loyalty + 5);
                message += `${second}의 충성도가 약간 상승했습니다. `;
            }
            return a;
        });
        
        updateState({ ...reward, agents: updatedAgents, currentScenarioId: 'betrayal_resolution_result' }, message);
    },
    mediate_betrayal: () => {
        if (!spendActionPoint()) return;
        const message = "당신의 함정에 배신자가 걸려들었습니다! 조직의 평판이 상승합니다. (+10 평판, +5 대담함)";
        updateState({ reputation: gameState.reputation + 10, daring: gameState.daring + 5, currentScenarioId: 'betrayal_resolution_result' }, message);
    },
    ignore_event: () => {
        if (!spendActionPoint()) return;
        const message = "의심을 무시했습니다. 조직 내 불신이 깊어집니다. (-10 평판, -5 행동력)";
        const updatedAgents = gameState.agents.map(a => {
            a.loyalty = Math.max(0, a.loyalty - 5);
            return a;
        });
        updateState({ reputation: gameState.reputation - 10, action: gameState.action - 5, agents: updatedAgents, currentScenarioId: 'betrayal_resolution_result' }, message);
    },
    show_resource_collection_options: () => updateState({ currentScenarioId: 'action_resource_collection' }),
    show_facility_options: () => updateState({ currentScenarioId: 'action_facility_management' }),
    perform_gather_intel: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.agentLevel * 0.1) + (gameState.dailyBonus.missionSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "정보 수집에 성공했습니다! (+5 정보)";
            changes.resources = { ...gameState.resources, intel: gameState.resources.intel + 5 };
        } else {
            message = "정보 수집에 실패했습니다.";
        }
        updateState(changes, message);
    },
    perform_craft_gadgets: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.agentLevel * 0.1) + (gameState.dailyBonus.missionSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "장비 제작에 성공했습니다! (+5 장비)";
            changes.resources = { ...gameState.resources, gadgets: gameState.resources.gadgets + 5 };
        } else {
            message = "장비 제작에 실패했습니다.";
        }
        updateState(changes, message);
    },
    perform_manage_network: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.agentLevel * 0.1) + (gameState.dailyBonus.missionSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "인맥 관리에 성공했습니다! (+5 인맥)";
            changes.resources = { ...gameState.resources, network: gameState.resources.network + 5 };
        } else {
            message = "인맥 관리에 실패했습니다.";
        }
        updateState(changes, message);
    },
    build_safe_house: () => {
        if (!spendActionPoint()) return;
        const cost = { intel: 50, network: 20 };
        let message = "";
        let changes = {};
        if (gameState.resources.network >= cost.network && gameState.resources.intel >= cost.intel) {
            gameState.equipment.safeHouse.built = true;
            message = "안전가옥을 확보했습니다!";
            changes.reputation = gameState.reputation + 10;
            changes.resources = { ...gameState.resources, network: gameState.resources.network - cost.network, intel: gameState.resources.intel - cost.intel };
        } else {
            message = "자원이 부족하여 확보할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_gadget_lab: () => {
        if (!spendActionPoint()) return;
        const cost = { gadgets: 30, network: 30 };
        let message = "";
        let changes = {};
        if (gameState.resources.gadgets >= cost.gadgets && gameState.resources.network >= cost.network) {
            gameState.equipment.gadgetLab.built = true;
            message = "장비 개발실을 구축했습니다!";
            changes.action = gameState.action + 10;
            changes.resources = { ...gameState.resources, gadgets: gameState.resources.gadgets - cost.gadgets, network: gameState.resources.network - cost.network };
        } else {
            message = "자원이 부족하여 구축할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_command_center: () => {
        if (!spendActionPoint()) return;
        const cost = { intel: 100, gadgets: 50, network: 50 };
        let message = "";
        let changes = {};
        if (gameState.resources.gadgets >= cost.gadgets && gameState.resources.network >= cost.network && gameState.resources.intel >= cost.intel) {
            gameState.equipment.commandCenter.built = true;
            message = "지휘 본부를 설립했습니다!";
            changes.reputation = gameState.reputation + 20;
            changes.action = gameState.action + 20;
            changes.resources = { ...gameState.resources, gadgets: gameState.resources.gadgets - cost.gadgets, network: gameState.resources.network - cost.network, intel: gameState.resources.intel - cost.intel };
        } else {
            message = "자원이 부족하여 설립할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_training_center: () => {
        if (!spendActionPoint()) return;
        const cost = { gadgets: 80, network: 40 };
        let message = "";
        let changes = {};
        if (gameState.resources.gadgets >= cost.gadgets && gameState.resources.network >= cost.network) {
            gameState.equipment.trainingCenter.built = true;
            message = "훈련 센터를 설립했습니다!";
            changes.daring = gameState.daring + 15;
            changes.reputation = gameState.reputation + 10;
            changes.resources = { ...gameState.resources, gadgets: gameState.resources.gadgets - cost.gadgets, network: gameState.resources.network - cost.network };
        } else {
            message = "자원이 부족하여 설립할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_vehicle_depot: () => {
        if (!spendActionPoint()) return;
        const cost = { gadgets: 50, network: 100 };
        let message = "";
        let changes = {};
        if (gameState.resources.gadgets >= cost.gadgets && gameState.resources.network >= cost.network) {
            gameState.equipment.vehicleDepot.built = true;
            message = "차량기지를 확보했습니다!";
            changes.resources = { ...gameState.resources, gadgets: gameState.resources.gadgets - cost.gadgets, network: gameState.resources.network - cost.network };
        } else {
            message = "자원이 부족하여 확보할 수 없습니다.";
        }
        updateState(changes, message);
    },
    maintain_facility: (params) => {
        if (!spendActionPoint()) return;
        const facilityKey = params.facility;
        const cost = { gadgets: 10, network: 10 };
        let message = "";
        let changes = {};
        if (gameState.resources.gadgets >= cost.gadgets && gameState.resources.network >= cost.network) {
            gameState.equipment[facilityKey].durability = 100;
            message = `${facilityKey} 장비의 보수를 완료했습니다. 내구도가 100으로 회복되었습니다.`;
            changes.resources = { ...gameState.resources, gadgets: gameState.resources.gadgets - cost.gadgets, network: gameState.resources.network - cost.network };
        } else {
            message = "보수에 필요한 자원이 부족합니다.";
        }
        updateState(changes, message);
    },
    upgrade_agent_level: () => {
        if (!spendActionPoint()) return;
        const cost = 20 * (gameState.agentLevel + 1);
        if (gameState.resources.gadgets >= cost && gameState.resources.network >= cost) {
            gameState.agentLevel++;
            updateState({ resources: { ...gameState.resources, gadgets: gameState.resources.gadgets - cost, network: gameState.resources.network - cost }, agentLevel: gameState.agentLevel });
            updateGameDisplay(`요원 레벨이 올랐습니다! 모든 작전 성공률이 10% 증가합니다. (현재 레벨: ${gameState.agentLevel})`);
        } else { updateGameDisplay(`레벨업에 필요한 자원이 부족합니다. (장비 ${cost}, 인맥 ${cost} 필요)`); }
        updateState({ currentScenarioId: 'intro' });
    },
    analyze_intel: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        if (rand < 0.3) { updateState({ resources: { ...gameState.resources, gadgets: gameState.resources.gadgets + 20, network: gameState.resources.network + 20 } }); updateGameDisplay("정보 분석 중 적의 약점을 발견했습니다! (+20 장비, +20 인맥)"); }
        else if (rand < 0.5) { updateState({ daring: gameState.daring + 10, reputation: gameState.reputation + 10 }); updateGameDisplay("정보를 통해 다음 작전의 성공 확률을 높였습니다. (+10 대담함, +10 평판)"); }
        else { updateGameDisplay("정보를 분석했지만, 특별한 것은 발견하지 못했습니다."); }
        updateState({ currentScenarioId: 'intro' });
    },
    accept_deal: () => {
        if (!spendActionPoint()) return;
        if (gameState.resources.network >= 50) {
            updateState({ resources: { ...gameState.resources, network: gameState.resources.network - 50, secret_docs: (gameState.resources.secret_docs || 0) + 1 } });
            updateGameDisplay("거래에 성공하여 비밀 문서를 얻었습니다! 조직의 평판이 상승합니다.");
        } else { updateGameDisplay("거래에 필요한 인맥이 부족합니다."); }
        updateState({ currentScenarioId: 'intro' });
    },
    decline_deal: () => {
        if (!spendActionPoint()) return;
        updateGameDisplay("거래를 거절했습니다. 다음 기회를 노려봐야겠습니다.");
        updateState({ currentScenarioId: 'intro' });
    },
    return_to_intro: () => updateState({ currentScenarioId: 'intro' }),
    play_minigame: () => {
        if (gameState.dailyActions.minigamePlayed) { updateGameDisplay("오늘의 미니게임은 이미 플레이했습니다."); return; }
        if (!spendActionPoint()) return;
        
        const minigameIndex = (gameState.day - 1) % minigames.length;
        const minigame = minigames[minigameIndex];
        
        gameState.currentScenarioId = `minigame_${minigame.name}`;
        
        updateState({ dailyActions: { ...gameState.dailyActions, minigamePlayed: true } }); 
        
        updateGameDisplay(minigame.description);
        minigame.start(document.getElementById('gameArea'), document.getElementById('gameChoices'));
    }
};

function applyStatEffects() {
    let message = "";
    if (gameState.daring >= 70) {
        gameState.dailyBonus.missionSuccess += 0.1;
        message += "높은 대담함 덕분에 작전 성공률이 증가합니다. ";
    }
    if (gameState.daring < 30) {
        gameState.agents.forEach(a => a.loyalty = Math.max(0, a.loyalty - 5));
        message += "부족한 대담함으로 인해 요원들의 충성도가 하락합니다. ";
    }

    if (gameState.action >= 70) {
        gameState.maxActionPoints += 1;
        gameState.actionPoints = gameState.maxActionPoints;
        message += "넘치는 행동력 덕분에 하루에 더 많은 작전을 수행할 수 있습니다. ";
    }
    if (gameState.action < 30) {
        gameState.maxActionPoints = Math.max(5, gameState.maxActionPoints - 1);
        gameState.actionPoints = Math.min(gameState.actionPoints, gameState.maxActionPoints);
        message += "행동력이 부족하여 작전 수행에 차질이 생깁니다. ";
    }

    if (gameState.reputation >= 70) {
        Object.keys(gameState.equipment).forEach(key => {
            if (gameState.equipment[key].built) gameState.equipment[key].durability = Math.min(100, gameState.equipment[key].durability + 1);
        });
        message += "높은 평판 덕분에 장비 관리가 더 잘 이루어집니다. ";
    }
    if (gameState.reputation < 30) {
        Object.keys(gameState.equipment).forEach(key => {
            if (gameState.equipment[key].built) gameState.equipment[key].durability = Math.max(0, gameState.equipment[key].durability - 2);
        });
        message += "평판이 하락하여 장비가 빠르게 노후화됩니다. ";
    }
    return message;
}

function generateRandomAgent() {
    const names = ["요원 X", "요원 Y", "요원 Z", "블랙 위도우"];
    const personalities = ["냉철한", "저돌적인", "분석적인", "신비로운"];
    const skills = ["정보 분석", "잠입", "해킹", "전투"];
    const randomId = Math.random().toString(36).substring(2, 9);

    return {
        id: randomId,
        name: names[Math.floor(currentRandFn() * names.length)],
        personality: personalities[Math.floor(currentRandFn() * personalities.length)],
        skill: skills[Math.floor(currentRandFn() * skills.length)],
        loyalty: 50
    };
}

// --- Daily/Initialization Logic ---
function processDailyEvents() {
    if (gameState.dailyEventTriggered) return;
    currentRandFn = mulberry32(getDailySeed() + gameState.day);

    updateState({
        actionPoints: 10,
        maxActionPoints: 10,
        dailyActions: { patrolled: false, briefingHeld: false, talkedTo: [], minigamePlayed: false },
        dailyEventTriggered: true,
        dailyBonus: { missionSuccess: 0 }
    });

    const statEffectMessage = applyStatEffects();

    let skillBonusMessage = "";
    let durabilityMessage = "";

    gameState.agents.forEach(a => {
        if (a.skill === '정보 분석') { gameState.resources.intel++; skillBonusMessage += `${a.name}의 능력 덕분에 정보를 추가로 얻었습니다. `; }
        else if (a.skill === '잠입') { gameState.resources.gadgets++; skillBonusMessage += `${a.name}의 도움으로 장비를 추가로 얻었습니다. `; }
        else if (a.skill === '해킹') { gameState.resources.network++; skillBonusMessage += `${a.name} 덕분에 인맥이 +1 증가했습니다. `; }
    });

    Object.keys(gameState.equipment).forEach(key => {
        const facility = gameState.equipment[key];
        if(facility.built) {
            facility.durability -= 1;
            if(facility.durability <= 0) {
                facility.built = false;
                durabilityMessage += `${key} 장비가 파손되었습니다! 보수가 필요합니다. `;
            }
        }
    });

    gameState.resources.intel -= gameState.agents.length * 2;
    let dailyMessage = "새로운 작전일이 시작되었습니다. ";
    dailyMessage += statEffectMessage + skillBonusMessage + durabilityMessage;
    if (gameState.resources.intel < 0) {
        gameState.reputation -= 10;
        dailyMessage += "정보가 부족하여 조직의 평판이 하락합니다! (-10 평판)";
    }
    
    const rand = currentRandFn();
    let eventId = "intro";
    if (rand < 0.15) { eventId = "daily_event_ambush"; updateState({resources: {...gameState.resources, gadgets: Math.max(0, gameState.resources.gadgets - 10)}}); }
    else if (rand < 0.30) { eventId = "daily_event_misinformation"; updateState({resources: {...gameState.resources, intel: Math.max(0, gameState.resources.intel - 10)}}); }
    else if (rand < 0.5 && gameState.agents.length >= 2) { eventId = "daily_event_betrayal"; }
    else if (rand < 0.7 && gameState.equipment.commandCenter.built) {
        eventId = "daily_event_new_agent";
        const newAgent = generateRandomAgent();
        gameState.pendingNewAgent = newAgent;
        gameScenarios["daily_event_new_agent"].text = `새로운 요원 ${newAgent.name}(${newAgent.personality}, ${newAgent.skill})이(가) 합류하고 싶어 합니다. (현재 팀원: ${gameState.agents.length} / ${gameState.maxAgents})`;
    }
    else if (rand < 0.85 && gameState.equipment.commandCenter.built) { eventId = "daily_event_ally"; }
    
    gameState.currentScenarioId = eventId;
    updateGameDisplay(dailyMessage + (gameScenarios[eventId]?.text || ''));
    renderChoices(gameScenarios[eventId].choices);
    saveGameState();
}

function initDailyGame() {
    loadGameState();
}

function resetGame() {
    if (confirm("정말로 모든 작전을 초기화하시겠습니까? 모든 진행 상황이 사라집니다.")) {
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
