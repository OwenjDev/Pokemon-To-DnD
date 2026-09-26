// ============================================================
// POKÉMON -> D&D CONVERTER
// ============================================================

// ================== RULE TABLES ==================

const STAT_TO_ABILITY = [
  [1, 40, 8], [41, 60, 10], [61, 80, 12], [81, 100, 14],
  [101, 120, 16], [121, 140, 18], [141, 160, 20],
  [161, 220, 22], [221, 999, 25],
];

const TYPE_MAP = {
  normal: "Bludgeoning/Slashing",
  fire: "Fire",
  water: "Cold",
  electric: "Lightning",
  grass: "Poison/Slashing",
  ice: "Cold",
  fighting: "Bludgeoning",
  poison: "Poison",
  ground: "Bludgeoning",
  flying: "Slashing",
  psychic: "Psychic",
  bug: "Piercing",
  rock: "Bludgeoning",
  ghost: "Necrotic",
  dragon: "Force",
  dark: "Necrotic",
  steel: "Slashing",
  fairy: "Radiant",
};

const BASE_POWER_TO_DAMAGE = [
  [0, 40, "1d6"], [41, 60, "2d6"], [61, 80, "3d6"],
  [81, 100, "4d6"], [101, 120, "5d6"], [121, 999, "6d6+"],
];

const AILMENT_TO_DND = {
  paralysis: "The target must succeed on a CON save or have its speed halved and be unable to take reactions until the end of its next turn.",
  burn: "The target must succeed on a CON save or become burned. A burned creature takes 1d6 Fire damage at the start of its next turn.",
  poison: "The target must succeed on a CON save or become Poisoned until the end of its next turn.",
  "badly-poison": "The target must succeed on a CON save or become Poisoned for 1 minute. It repeats the save at the end of each of its turns, ending the effect on a success.",
  sleep: "The target must succeed on a WIS save or fall Unconscious until the end of its next turn. The effect ends early if it takes damage.",
  freeze: "The target must succeed on a CON save or become Restrained until the end of its next turn.",
  confusion: "The target must succeed on a WIS save or become confused until the end of its next turn. While confused, it cannot take reactions and has disadvantage on attack rolls.",
  infatuation: "The target must succeed on a WIS save or have disadvantage on attacks against the user until the end of its next turn.",
  trap: "The target must succeed on a STR save or become Grappled until the end of its next turn.",
  torment: "The target must succeed on a WIS save or be unable to use the same action or move on consecutive turns until the end of its next turn.",
  disable: "The target must succeed on a WIS save or be unable to use the move it most recently used until the end of its next turn.",
  yawn: "At the end of its next turn, the target must succeed on a WIS save or fall Unconscious until the end of the following turn.",
  "no-type-immunity": "The target temporarily loses immunity to this move's damage type until the end of the user's next turn.",
  leech_seed: "At the start of the target's next turn, it takes 1d6 Necrotic damage and the user regains the same number of hit points.",
  nightmare: "If the target is Unconscious, it takes 1d6 Psychic damage at the start of its turn.",
  curse: "The target is cursed until the end of the user's next turn.",
  embargo: "The target cannot benefit from held or carried items until the end of its next turn.",
  heal_block: "The target cannot regain hit points until the end of its next turn.",
  silence: "The target cannot use moves requiring speech or sound until the end of its next turn.",
};

const STAT_TO_DND = {
  attack: { positive: "attack rolls and damage rolls", negative: "attack rolls and damage rolls" },
  defense: { positive: "AC", negative: "AC" },
  speed: { positive: "speed", negative: "speed" },
  "special-attack": { positive: "special attack rolls and damage rolls", negative: "special attack rolls and damage rolls" },
  "special-defense": { positive: "saving throws", negative: "saving throws" },
  accuracy: { positive: "attack rolls", negative: "attack rolls" },
  evasion: { positive: "AC", negative: "AC" },
};

// ================== STATE ==================

let currentPokemon = null;
let currentSpecies = null;
let shiny = false;
let selectedMoves = new Map();
let currentAbilities = [];
let lastAbilities = null;
let lastAC = 10;
let lastHP = 1;
let lastAttackBonus = 0;
let lastSaveDC = 10;
let lastBaseBlock = "";
let savedPokemon = loadSavedPokemon();

// ================== HELPERS ==================

const $ = id => document.getElementById(id);
const mod = score => Math.floor((score - 10) / 2);

function signedMod(score) {
  const m = mod(score);
  return m >= 0 ? `+${m}` : `${m}`;
}

function titleCase(text) {
  return String(text ?? "").replaceAll("-", " ").replace(/\b\w/g, c => c.toUpperCase());
}

function convertStat(base) {
  for (const [low, high, score] of STAT_TO_ABILITY) {
    if (base >= low && base <= high) return score;
  }
  return 10;
}

function basePowerToDamage(bp) {
  if (bp == null) return null;
  for (const [low, high, dice] of BASE_POWER_TO_DAMAGE) {
    if (bp >= low && bp <= high) return dice;
  }
  return null;
}

function toDnDLevel(pokemonLevel) {
  return Math.min(20, Math.max(1, Math.ceil(pokemonLevel / 5)));
}

function proficiencyBonus(dndLevel) {
  if (dndLevel >= 17) return 6;
  if (dndLevel >= 13) return 5;
  if (dndLevel >= 9) return 4;
  if (dndLevel >= 5) return 3;
  return 2;
}

function hitDieFromBaseHP(hp) {
  if (hp <= 45) return 6;
  if (hp <= 80) return 8;
  if (hp <= 110) return 10;
  return 12;
}

function calcHP(baseHP, con, pokemonLevel) {
  const dndLevel = toDnDLevel(pokemonLevel);
  const die = hitDieFromBaseHP(baseHP);
  const averageRoll = (die / 2) + 0.5;
  const hp = Math.max(1, Math.floor((averageRoll + mod(con)) * dndLevel));
  return { hp, die, dl: dndLevel };
}

function calculateCR({ hp, ac, dpr, atk }) {
  const defensive = hp / 15 + (ac - 13) * 0.6;
  const offensive = dpr / 6 + atk * 0.35;
  return Math.max(1, Math.min(30, Math.round((defensive + offensive) / 2)));
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fetch failed (${response.status})`);
  return response.json();
}

function showError(message = "") {
  const box = $("errorBox");
  if (!message) {
    box.hidden = true;
    box.textContent = "";
  } else {
    box.hidden = false;
    box.textContent = message;
  }
}

// ================== ACCURACY / SAVE DC ==================

function accuracyModifier(accuracy) {
  if (accuracy == null) return 0;
  if (accuracy >= 100) return +1;
  if (accuracy >= 90) return 0;
  if (accuracy >= 80) return -1;
  if (accuracy >= 70) return -2;
  if (accuracy >= 50) return -3;
  return -4;
}

function calculateSaveDC(prof, abilities) {
  const bestRelevantMod = Math.max(mod(abilities.STR), mod(abilities.DEX), mod(abilities.INT));
  return 8 + prof + bestRelevantMod;
}

// ================== MOVE FETCHING ==================

async function getMoveDetails(url) {
  const move = await fetchJSON(url);
  const effectEntry = move.effect_entries?.find(entry => entry.language.name === "en");

  let effectText = effectEntry?.short_effect ?? effectEntry?.effect ?? "";
  if (move.effect_chance != null) {
    effectText = effectText.replaceAll("$effect_chance", move.effect_chance);
  }

  return {
    apiName: move.name,
    name: titleCase(move.name),
    power: move.power,
    accuracy: move.accuracy,
    pp: move.pp,
    priority: move.priority ?? 0,
    effectChance: move.effect_chance,
    type: move.type?.name ?? "normal",
    class: move.damage_class?.name ?? "status",
    target: move.target?.name ?? "selected-pokemon",
    effectText,
    ailment: move.meta?.ailment?.name ?? "none",
    ailmentChance: move.meta?.ailment_chance ?? 0,
    category: move.meta?.category?.name ?? null,
    flinchChance: move.meta?.flinch_chance ?? 0,
    critRate: move.meta?.crit_rate ?? 0,
    drain: move.meta?.drain ?? 0,
    healing: move.meta?.healing ?? 0,
    minHits: move.meta?.min_hits ?? null,
    maxHits: move.meta?.max_hits ?? null,
    minTurns: move.meta?.min_turns ?? null,
    maxTurns: move.meta?.max_turns ?? null,
    statChance: move.meta?.stat_chance ?? 0,
    statChanges: (move.stat_changes ?? []).map(change => ({
      stat: change.stat.name,
      change: change.change
    }))
  };
}

function convertMove(move, stabTypes) {
  return {
    ...move,
    dndType: TYPE_MAP[move.type] ?? titleCase(move.type),
    dice: move.class === "status" ? null : basePowerToDamage(move.power),
    stab: stabTypes.includes(move.type)
  };
}

// ================== TARGET HELPERS ==================

function moveTargetsSelf(move) {
  return ["user", "users-field"].includes(move.target);
}

function targetDescription(move) {
  const targets = {
    user: "Self",
    "selected-pokemon": "One creature",
    "selected-pokemon-me-first": "One creature",
    "random-opponent": "One random hostile creature",
    "all-opponents": "All hostile creatures in range",
    "all-other-pokemon": "All other creatures in range",
    "all-pokemon": "All creatures in range",
    "user-and-allies": "The user and its allies",
    ally: "One ally",
    "user-or-ally": "The user or one ally",
    "users-field": "The user's side of the battlefield",
    "opponents-field": "The opposing side of the battlefield",
    "entire-field": "The battlefield",
  };
  return targets[move.target] ?? titleCase(move.target);
}

// ================== STAT / AILMENT TRANSLATION ==================

function translateStatChange(change, move) {
  const statRule = STAT_TO_DND[change.stat];
  if (!statRule) return `${titleCase(change.stat)} changes by ${change.change} stage(s).`;

  const amount = Math.abs(change.change);
  const selfTarget = moveTargetsSelf(move) || change.change > 0;
  const subject = selfTarget ? "The user" : "The target";

  if (change.stat === "defense" || change.stat === "evasion") {
    const bonus = Math.min(4, amount * 2);
    return change.change > 0
      ? `${subject} gains +${bonus} AC until the end of its next turn.`
      : `${subject} takes -${bonus} AC until the end of its next turn.`;
  }

  if (change.stat === "speed") {
    const feet = amount * 10;
    return change.change > 0
      ? `${subject}'s speed increases by ${feet} feet until the end of its next turn.`
      : `${subject}'s speed decreases by ${feet} feet until the end of its next turn.`;
  }

  if (change.stat === "attack" || change.stat === "special-attack") {
    if (change.change >= 2) return `${subject} has advantage on ${statRule.positive} until the end of its next turn.`;
    if (change.change === 1) return `${subject} gains +2 to ${statRule.positive} until the end of its next turn.`;
    if (change.change <= -2) return `${subject} has disadvantage on ${statRule.negative} until the end of its next turn.`;
    return `${subject} takes -2 to ${statRule.negative} until the end of its next turn.`;
  }

  if (change.stat === "special-defense") {
    if (change.change >= 2) return `${subject} has advantage on saving throws until the end of its next turn.`;
    if (change.change === 1) return `${subject} gains +2 to saving throws until the end of its next turn.`;
    if (change.change <= -2) return `${subject} has disadvantage on saving throws until the end of its next turn.`;
    return `${subject} takes -2 to saving throws until the end of its next turn.`;
  }

  if (change.stat === "accuracy") {
    return change.change > 0
      ? `${subject} gains +${amount * 2} to attack rolls until the end of its next turn.`
      : `${subject} takes -${amount * 2} to attack rolls until the end of its next turn.`;
  }

  return `${titleCase(change.stat)} changes by ${change.change} stage(s).`;
}

function translateAilment(move, saveDC) {
  if (!move.ailment || move.ailment === "none") return null;
  const effect = AILMENT_TO_DND[move.ailment];
  if (!effect) return `DC ${saveDC}: ${titleCase(move.ailment)}.`;

  let prefix = `DC ${saveDC}: `;
  const chance = move.ailmentChance || move.effectChance;
  if (chance && chance < 100) prefix += `${chance}% secondary effect — `;
  return prefix + effect;
}

// ================== AUTOMATIC MOVE DESCRIPTION ==================

function translateMoveToDnD(move, baseAttackBonus, saveDC) {
  if (SPECIAL_MOVES[move.apiName]) return SPECIAL_MOVES[move.apiName];

  const parts = [`Target: ${targetDescription(move)}.`];
  let handledSomething = false;

  if (move.class !== "status") {
    if (move.dice) {
      const attackBonus = baseAttackBonus + accuracyModifier(move.accuracy);
      const attackText = attackBonus >= 0 ? `+${attackBonus}` : `${attackBonus}`;
      parts.push(`Attack: ${attackText} to hit.`);

      let damage = `${move.dice} ${move.dndType} damage`;
      if (move.stab) damage += " (STAB: add the user's proficiency bonus to the damage)";
      parts.push(`Hit: ${damage}.`);
      handledSomething = true;
    } else {
      parts.push("Damage is determined by this move's special rules.");
    }
  } else if (move.accuracy != null && !moveTargetsSelf(move)) {
    parts.push(`Save DC ${saveDC}.`);
  }

  const ailment = translateAilment(move, saveDC);
  if (ailment) {
    parts.push(ailment);
    handledSomething = true;
  }

  for (const statChange of move.statChanges) {
    let text = translateStatChange(statChange, move);
    if (move.statChance > 0 && move.statChance < 100) {
      text = `${move.statChance}% secondary effect: ${text}`;
    }
    parts.push(text);
    handledSomething = true;
  }

  if (move.healing > 0) {
    parts.push(`The user regains ${move.healing}% of its maximum hit points.`);
    handledSomething = true;
  }
  if (move.drain > 0) {
    parts.push(`The user regains hit points equal to ${move.drain}% of the damage dealt.`);
    handledSomething = true;
  }
  if (move.drain < 0) {
    parts.push(`The user takes recoil damage equal to ${Math.abs(move.drain)}% of the damage dealt.`);
    handledSomething = true;
  }
  if (move.flinchChance > 0) {
    parts.push(`${move.flinchChance}% secondary effect: the target cannot take reactions until the start of its next turn.`);
    handledSomething = true;
  }
  if (move.critRate > 0) {
    parts.push(move.critRate === 1
      ? "This move scores a critical hit on a natural 19 or 20."
      : "This move scores a critical hit on a natural 18–20.");
    handledSomething = true;
  }
  if (move.minHits != null && move.maxHits != null) {
    parts.push(move.minHits === move.maxHits
      ? `The attack hits ${move.minHits} times. Roll damage separately for each hit.`
      : `The attack hits ${move.minHits}–${move.maxHits} times. Roll damage separately for each hit.`);
    handledSomething = true;
  }
  if (move.priority > 0) {
    parts.push("Priority: this move may be used as a bonus action.");
    handledSomething = true;
  } else if (move.priority < 0) {
    parts.push("Low priority: this move cannot be used as a reaction or bonus action.");
    handledSomething = true;
  }

  const genericDescriptions = [
    "inflicts regular damage with no additional effect.",
    "inflicts regular damage."
  ];
  const lowerEffect = move.effectText.toLowerCase();
  const hasMeaningfulEffectText = move.effectText &&
    !genericDescriptions.some(text => lowerEffect.startsWith(text));

  if (move.class === "status" && !handledSomething && hasMeaningfulEffectText) {
    parts.push("⚠ SPECIAL — manual conversion recommended.");
    parts.push(`Pokémon effect: ${move.effectText}`);
  } else if (move.class !== "status" && move.power == null && hasMeaningfulEffectText) {
    parts.push("⚠ SPECIAL — manual conversion recommended.");
    parts.push(`Pokémon effect: ${move.effectText}`);
  }

  return parts.join(" ");
}

// ================== DPR ==================

function averageDamageFromDice(dice) {
  return { "1d6": 3.5, "2d6": 7, "3d6": 10.5, "4d6": 14, "5d6": 17.5, "6d6+": 21 }[dice] ?? 0;
}

function estimateDPR(moves) {
  if (!moves.length) return 2;
  const damagingMoves = moves.filter(move => move.dice);
  if (!damagingMoves.length) return 2;

  const strongest = [...damagingMoves].sort(
    (a, b) => averageDamageFromDice(b.dice) - averageDamageFromDice(a.dice)
  )[0];

  const average = averageDamageFromDice(strongest.dice);
  let hitChance = strongest.accuracy == null ? 0.85 : strongest.accuracy / 100;
  hitChance = Math.max(0.25, Math.min(0.95, hitChance));
  return average * hitChance;
}

// ================== ABILITIES ==================

async function getAbilityDetails(abilityEntry) {
  const ability = await fetchJSON(abilityEntry.ability.url);
  const english = ability.effect_entries?.find(entry => entry.language.name === "en");

  return {
    name: ability.name,
    displayName: titleCase(ability.name),
    hidden: abilityEntry.is_hidden,
    originalEffect: english?.short_effect ?? english?.effect ?? "No English effect description available.",
    dndEffect: ABILITY_EFFECTS[ability.name] ?? null
  };
}

async function loadAbilities(data) {
  currentAbilities = await Promise.all(data.abilities.map(entry => getAbilityDetails(entry)));
}

function abilityText() {
  if (!currentAbilities.length) return "Abilities\n• None found";

  const lines = ["Abilities"];
  for (const ability of currentAbilities) {
    const hidden = ability.hidden ? " [Hidden]" : "";
    lines.push(`• ${ability.displayName}${hidden}`);
    if (ability.dndEffect) {
      lines.push(`  ${ability.dndEffect}`);
    } else {
      lines.push("  ⚠ No D&D conversion written yet.");
      lines.push(`  Pokémon effect: ${ability.originalEffect}`);
    }
  }
  return lines.join("\n");
}

// ================== EVENTS ==================

$("pokeLevel").oninput = event => $("levelLabel").textContent = event.target.value;
$("generateBtn").onclick = generate;
$("randomBtn").onclick = generateRandomPokemon;
$("shinyBtn").onclick = toggleShiny;
$("addSavedBtn").onclick = addCurrentToSaved;
$("copySavedBtn").onclick = copySavedList;
$("clearSavedBtn").onclick = clearSavedList;
$("copyBtn").onclick = async () => {
  await navigator.clipboard.writeText($("output").textContent);
  const button = $("copyBtn");
  const old = button.textContent;
  button.textContent = "Copied!";
  setTimeout(() => button.textContent = old, 1000);
};
$("pokemonName").addEventListener("keydown", event => {
  if (event.key === "Enter") generate();
});

renderSavedList();

// ================== GENERATE ==================

async function generate() {
  const name = $("pokemonName").value.trim().toLowerCase().replaceAll(" ", "-");
  const pokemonLevel = +$("pokeLevel").value;
  if (!name) return;

  showError();
  selectedMoves.clear();
  currentAbilities = [];
  $("moveCount").textContent = "Select up to six.";
  $("learnset").innerHTML = '<div class="emptyState">Loading moves…</div>';
  $("output").textContent = "Loading Pokémon…";
  $("generateBtn").disabled = true;

  try {
    const data = await fetchJSON(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(name)}`);
    const species = await fetchJSON(data.species.url);

    currentPokemon = data;
    currentSpecies = species;
    $("sprite").src = data.sprites.front_default ?? "";
    $("sprite").alt = `${titleCase(data.name)} sprite`;
    $("shinyBtn").disabled = false;
    $("addSavedBtn").disabled = false;
    shiny = false;

    const types = data.types.map(entry => entry.type.name);
    $("badges").innerHTML = types
      .map(type => `<span>${type} → ${TYPE_MAP[type] ?? titleCase(type)}</span>`)
      .join("");

    const entry = species.flavor_text_entries.find(item => item.language.name === "en");
    $("dexEntry").textContent = entry?.flavor_text.replace(/\s+/g, " ") ?? "";

    const base = {};
    data.stats.forEach(stat => base[stat.stat.name] = stat.base_stat);

    const abilities = {
      STR: convertStat(base.attack),
      DEX: convertStat(base.speed),
      CON: convertStat(base.defense),
      INT: convertStat(base["special-attack"]),
      WIS: convertStat(base["special-defense"]),
      CHA: 10
    };

    const armoredTypeBonus = types.includes("rock") || types.includes("steel") ? 2 : 0;
    const ac = 10 + mod(abilities.DEX) + armoredTypeBonus;
    const hpInfo = calcHP(base.hp, abilities.CON, pokemonLevel);
    const prof = proficiencyBonus(hpInfo.dl);
    const bestAttackMod = Math.max(mod(abilities.STR), mod(abilities.DEX), mod(abilities.INT));
    const attackBonus = prof + bestAttackMod;
    const saveDC = calculateSaveDC(prof, abilities);

    lastAbilities = abilities;
    lastAC = ac;
    lastHP = hpInfo.hp;
    lastAttackBonus = attackBonus;
    lastSaveDC = saveDC;

    lastBaseBlock =
`Name: ${data.name.toUpperCase()} (Lv ${pokemonLevel})
Types: ${types.join(", ")}

AC ${ac}
HP ${hpInfo.hp} (${hpInfo.dl}d${hpInfo.die})
Proficiency Bonus: +${prof}
Save DC: ${saveDC}

STR ${abilities.STR} (${signedMod(abilities.STR)})
DEX ${abilities.DEX} (${signedMod(abilities.DEX)})
CON ${abilities.CON} (${signedMod(abilities.CON)})
INT ${abilities.INT} (${signedMod(abilities.INT)})
WIS ${abilities.WIS} (${signedMod(abilities.WIS)})
CHA ${abilities.CHA} (${signedMod(abilities.CHA)})`;

    await loadAbilities(data);
    renderLearnset(data.moves, pokemonLevel, types);
    updateOutput();

  } catch (error) {
    console.error(error);
    const friendly = error.message.includes("(404)")
      ? `I couldn't find "${name}" in PokéAPI. Check the spelling and try again.`
      : "Something went wrong while loading Pokémon data. Try again in a moment.";
    showError(friendly);
    $("output").textContent = "Unable to generate this Pokémon.";
    $("learnset").innerHTML = '<div class="emptyState">No moves loaded.</div>';
  } finally {
    $("generateBtn").disabled = false;
  }
}

// ================== LEARNSET ==================

function renderLearnset(moves, pokemonLevel, stabTypes) {
  const rows = [];

  for (const moveEntry of moves) {
    const validEntries = moveEntry.version_group_details.filter(entry =>
      entry.move_learn_method.name === "level-up" &&
      entry.level_learned_at <= pokemonLevel
    );
    if (!validEntries.length) continue;

    rows.push({
      name: moveEntry.move.name,
      url: moveEntry.move.url,
      lv: Math.min(...validEntries.map(entry => entry.level_learned_at))
    });
  }

  const uniqueRows = [...new Map(rows.map(row => [row.name, row])).values()];
  uniqueRows.sort((a, b) => a.lv - b.lv || a.name.localeCompare(b.name));

  if (!uniqueRows.length) {
    $("learnset").innerHTML = '<div class="emptyState">No level-up moves found at this level.</div>';
    return;
  }

  $("learnset").innerHTML = uniqueRows.map(row => `
    <label class="learnRow">
      <span>Lv ${row.lv}</span>
      <input type="checkbox" data-url="${row.url}" data-name="${row.name}">
      ${titleCase(row.name)}
    </label>
  `).join("");

  $("learnset").querySelectorAll("input").forEach(checkbox => {
   checkbox.onchange = async event => {
      const moveName = event.target.dataset.name;

      if (event.target.checked) {
        if (selectedMoves.size >= 6) {
          event.target.checked = false;
          showError("You can select up to six moves.");
          return;
        }

        showError();
        event.target.disabled = true;

        try {
        const details = await getMoveDetails(event.target.dataset.url);
        const convertedMove = convertMove(details, stabTypes);

        selectedMoves.set(moveName, convertedMove);

    // Update only AFTER the move has been fetched and stored.
    $("moveCount").textContent = `${selectedMoves.size}/6 selected`;
    updateOutput();

  } catch (error) {
    console.error(error);
    event.target.checked = false;
    showError(`Couldn't load ${titleCase(moveName)}. Try selecting it again.`);
  } finally {
    event.target.disabled = false;
  }

} else {
  selectedMoves.delete(moveName);

  // Immediately update when a move is removed.
  $("moveCount").textContent = `${selectedMoves.size}/6 selected`;
  updateOutput();
}
    };
  });
}

// ================== OUTPUT ==================

function updateOutput() {
  const moves = [...selectedMoves.values()];
  const dpr = estimateDPR(moves);
  const cr = calculateCR({ hp: lastHP, ac: lastAC, dpr, atk: lastAttackBonus });

  const moveText = !moves.length
    ? "• (No moves selected)"
    : moves.map(move => {
        const translation = translateMoveToDnD(move, lastAttackBonus, lastSaveDC);
        const pokemonData = [`Type: ${titleCase(move.type)}`];
        if (move.power != null) pokemonData.push(`Power ${move.power}`);
        if (move.accuracy != null) pokemonData.push(`Accuracy ${move.accuracy}`);
        if (move.stab) pokemonData.push("STAB");

        return `${move.name}
  ${pokemonData.join(" | ")}
  ${translation}`;
      }).join("\n\n");

  $("output").textContent =
`${lastBaseBlock}

Attack Bonus: +${lastAttackBonus}
Estimated DPR: ${dpr.toFixed(1)}
Estimated CR: ${cr}

${abilityText()}

Moves
${moveText}`;

  $("copyBtn").disabled = false;
}

// ================== SHINY ==================

function toggleShiny() {
  if (!currentPokemon) return;
  shiny = !shiny;
  const normalSprite = currentPokemon.sprites.front_default;
  const shinySprite = currentPokemon.sprites.front_shiny;
  $("sprite").src = shiny && shinySprite ? shinySprite : normalSprite;
}


// ================== RANDOM POKÉMON ==================

async function generateRandomPokemon() {
  const button = $("randomBtn");
  button.disabled = true;
  const oldText = button.textContent;
  button.textContent = "Picking…";

  try {
    // Species IDs correspond to main Pokédex species, avoiding most special forms.
    const speciesIndex = await fetchJSON("https://pokeapi.co/api/v2/pokemon-species?limit=1");
    const randomId = Math.floor(Math.random() * speciesIndex.count) + 1;
    const species = await fetchJSON(`https://pokeapi.co/api/v2/pokemon-species/${randomId}`);
    $("pokemonName").value = species.name;
    await generate();
  } catch (error) {
    console.error(error);
    showError("Couldn't pick a random Pokémon. Try again.");
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
}

// ================== SAVED POKÉMON ==================

const SAVED_POKEMON_KEY = "pokemon-dnd-saved-v1";

function loadSavedPokemon() {
  try {
    return JSON.parse(localStorage.getItem("pokemon-dnd-saved-v1")) ?? [];
  } catch {
    return [];
  }
}

function persistSavedPokemon() {
  localStorage.setItem(SAVED_POKEMON_KEY, JSON.stringify(savedPokemon));
}

function addCurrentToSaved() {
  if (!currentPokemon) return;

  const moves = [...selectedMoves.values()].map(move => move.name);
  const level = +$("pokeLevel").value;
  const sprite = shiny && currentPokemon.sprites.front_shiny
    ? currentPokemon.sprites.front_shiny
    : currentPokemon.sprites.front_default;

  savedPokemon.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: titleCase(currentPokemon.name),
    apiName: currentPokemon.name,
    level,
    shiny,
    sprite,
    moves,
    statBlock: $("output").textContent
  });

  persistSavedPokemon();
  renderSavedList();
}

function removeSavedPokemon(id) {
  savedPokemon = savedPokemon.filter(mon => mon.id !== id);
  persistSavedPokemon();
  renderSavedList();
}

function clearSavedList() {
  if (!savedPokemon.length) return;
  if (!confirm("Clear all saved Pokémon?")) return;
  savedPokemon = [];
  persistSavedPokemon();
  renderSavedList();
}

function savedListText() {
  return savedPokemon.map(mon => {
    if (mon.statBlock) return mon.statBlock;

    // Backward-compatible fallback for Pokémon saved before full stat blocks
    // were stored. Re-add an old entry to capture its complete D&D block.
    const shinyLabel = mon.shiny ? " [Shiny]" : "";
    const moves = mon.moves.length ? mon.moves.join(", ") : "No moves selected";
    return `${mon.name}${shinyLabel} — Lv ${mon.level}\nMoves: ${moves}`;
  }).join("\n\n========================================\n\n");
}

async function copySavedList() {
  if (!savedPokemon.length) return;
  await navigator.clipboard.writeText(savedListText());
  const button = $("copySavedBtn");
  const oldText = button.textContent;
  button.textContent = "Copied!";
  setTimeout(() => button.textContent = oldText, 1000);
}

function renderSavedList() {
  const list = $("savedList");
  if (!list) return;

  $("savedCount").textContent = `(${savedPokemon.length})`;
  $("copySavedBtn").disabled = savedPokemon.length === 0;
  $("clearSavedBtn").disabled = savedPokemon.length === 0;

  if (!savedPokemon.length) {
    list.innerHTML = '<div class="emptyState">No Pokémon saved yet.</div>';
    return;
  }

  list.innerHTML = savedPokemon.map(mon => `
    <article class="savedCard">
      <img class="savedSprite" src="${mon.sprite ?? ""}" alt="${mon.name} sprite">
      <div class="savedInfo">
        <h3>${mon.name}${mon.shiny ? " ✨" : ""} — Lv ${mon.level}</h3>
        <p>${mon.moves.length ? mon.moves.join(" • ") : "No moves selected"}</p>
      </div>
      <button class="removeSavedBtn" data-saved-id="${mon.id}" title="Remove from saved list" aria-label="Remove ${mon.name}">✕</button>
    </article>
  `).join("");

  list.querySelectorAll(".removeSavedBtn").forEach(button => {
    button.onclick = () => removeSavedPokemon(button.dataset.savedId);
  });
}
