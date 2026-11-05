const TEXT_STOPS = ":(){}?*+";
const NAME = /[A-Za-z_$][\w$]*(?![\p{ID_Continue}$\u200C\u200D])/uy;
const STATIC = 4;
const MIXED = 3;
const PARAM = 2;
const OPTIONAL = 1;
let pathnamePattern;
function normalizePathname(pathname) {
  return pathname.replace(/\/+$/, "") || "/";
}
function canonicalPathname(pathname) {
  pathnamePattern ??= new URLPattern({ pathname: "*" });
  return normalizePathname(pathnamePattern.exec({ pathname }).pathname.input);
}
function readNamed(state) {
  state.pos++;
  NAME.lastIndex = state.pos;
  const match = NAME.exec(state.path);
  if (!match) {
    throw new Error(`Expected an ASCII parameter name ([A-Za-z_$][A-Za-z0-9_$]*) after ":" in path "${state.path}"`);
  }
  state.pos = NAME.lastIndex;
  return { type: "param", name: match[0] };
}
function readGroup(state) {
  state.pos++;
  const tokens = readTokens(state, true);
  state.pos++;
  const optional = state.path[state.pos] === "?";
  if (optional) {
    state.pos++;
  }
  return { type: "group", tokens, optional };
}
function readText(state) {
  let value = "";
  while (state.pos < state.path.length && !TEXT_STOPS.includes(state.path[state.pos])) {
    if (state.path[state.pos] === "\\") {
      state.pos++;
    }
    const char = state.path[state.pos++];
    if (char === "?" || char === "#") {
      throw new Error(`Literal URL delimiter "${char}" in path "${state.path}"; use ${char === "?" ? "%3F" : "%23"} instead`);
    }
    value += char ?? "";
  }
  return { type: "text", value };
}
const READERS = { ":": readNamed, "{": readGroup };
function readTokens(state, inGroup) {
  const tokens = [];
  while (state.pos < state.path.length) {
    const char = state.path[state.pos];
    if (char === "}") {
      if (!inGroup) {
        throw new Error(`Unexpected "}" in path "${state.path}"`);
      }
      return tokens;
    }
    if ("()*+?".includes(char)) {
      throw new Error(`Unsupported syntax "${char}" in path "${state.path}"; use named parameters, brace groups and escapes`);
    }
    tokens.push((READERS[char] ?? readText)(state));
  }
  if (inGroup) {
    throw new Error(`Unterminated "{" in path "${state.path}"`);
  }
  return tokens;
}
function tokenize(path) {
  return readTokens({ path, pos: 0 }, false);
}
function paramNames(tokens) {
  return tokens.flatMap((token) => {
    if (token.type === "group") {
      return paramNames(token.tokens);
    }
    return token.type === "param" ? [token.name] : [];
  });
}
function uniqueParamNames(tokens, label) {
  const names = paramNames(tokens);
  const duplicate = names.find((name, index) => names.indexOf(name) !== index);
  if (duplicate !== void 0) {
    throw new Error(`Route ${label} repeats param "${duplicate}"; param names must be unique within a branch`);
  }
  return names;
}
function closeSegment(state) {
  if (state.current !== null) {
    state.ranks.push(state.current);
  }
  state.current = null;
}
function addToSegment(state, rank) {
  if (state.current === null || state.current === rank) {
    state.current = rank;
  } else if (state.current >= MIXED || rank === STATIC) {
    state.current = MIXED;
  } else {
    state.current = Math.max(state.current, rank);
  }
}
function collectText(value, cap, state) {
  value.split("/").forEach((piece, index) => {
    if (index > 0) {
      closeSegment(state);
    }
    if (piece) {
      addToSegment(state, Math.min(cap, STATIC));
    }
  });
}
function collectRanks(tokens, cap, state) {
  for (const token of tokens) {
    if (token.type === "text") {
      collectText(token.value, cap, state);
    } else if (token.type === "group") {
      collectRanks(token.tokens, token.optional ? Math.min(cap, OPTIONAL) : cap, state);
    } else {
      addToSegment(state, Math.min(cap, PARAM));
    }
  }
}
function segmentRanks(tokens) {
  const state = { ranks: [], current: null };
  collectRanks(tokens, STATIC, state);
  closeSegment(state);
  return state.ranks;
}
function hasValue(params, name) {
  return Object.hasOwn(params, name) && params[name] !== void 0 && params[name] !== null && params[name] !== "";
}
function buildParam(token, params, routeName) {
  if (!hasValue(params, token.name)) {
    throw new Error(`Route "${routeName}" is missing param "${token.name}"`);
  }
  return encodeURIComponent(String(params[token.name]));
}
function buildGroup(group, params, routeName) {
  if (group.optional && !paramNames(group.tokens).some((name) => hasValue(params, name))) {
    return "";
  }
  return buildTokens(group.tokens, params, routeName);
}
function buildTokens(tokens, params, routeName) {
  return tokens.map((token) => {
    if (token.type === "text") {
      return token.value;
    }
    if (token.type === "group") {
      return buildGroup(token, params, routeName);
    }
    return buildParam(token, params, routeName);
  }).join("");
}
function createPattern(path, name, declaredPath) {
  try {
    return new URLPattern({ pathname: path });
  } catch (error) {
    throw new Error(`Invalid path "${declaredPath}" for route "${name}": ${error.message}`, { cause: error });
  }
}
function decodeParams(names, groups) {
  try {
    return Object.fromEntries(names.filter((name) => groups[name] !== void 0).map((name) => [name, decodeURIComponent(groups[name])]));
  } catch {
    return null;
  }
}
function compilePattern(path, name, names, declaredPath = path) {
  const pattern = createPattern(path, name, declaredPath);
  return {
    exec(pathname) {
      const groups = pattern.exec({ pathname })?.pathname.groups;
      return groups ? decodeParams(names, groups) : void 0;
    }
  };
}
class Pattern {
  #path;
  #tokens;
  names;
  constructor(path, label) {
    this.#path = path;
    this.#tokens = tokenize(path);
    this.names = uniqueParamNames(this.#tokens, label);
  }
  getRanks() {
    return segmentRanks(this.#tokens);
  }
  compile(name) {
    return compilePattern(this.#path, name, this.names);
  }
  compilePrefix() {
    return compilePattern(`${this.#path}{/*}?`, this.#path, this.names, this.#path);
  }
  build(params, name) {
    return normalizePathname(buildTokens(this.#tokens, params, name));
  }
}
export {
  Pattern,
  canonicalPathname,
  hasValue,
  normalizePathname
};
