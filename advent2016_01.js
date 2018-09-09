
const input = `
L1, L5, R1, R3, L4, L5, R5, R1, L2, L2, L3, R4, L2, R3, R1, L2, R5, R3, L4, R4, L3, R3, R3, L2, R1, L3, R2, L1, R4, L2, R4, L4, R5, L3, R1, R1, L1, L3, L2, R1, R3, R2, L1, R4, L4, R2, L189, L4, R5, R3, L1, R47, R4, R1, R3, L3, L3, L2, R70, L1, R4, R185, R5, L4, L5, R4, L1, L4, R5, L3, R2, R3, L5, L3, R5, L1, R5, L4, R1, R2, L2, L5, L2, R4, L3, R5, R1, L5, L4, L3, R4, L3, L4, L1, L5, L5, R5, L5, L2, L1, L2, L4, L1, L2, R3, R1, R1, L2, L5, R2, L3, L5, L4, L2, L1, L2, R3, L1, L4, R3, R3, L2, R5, L1, L3, L3, L3, L5, R5, R1, R2, L3, L2, R4, R1, R1, R3, R4, R3, L3, R3, L5, R2, L2, R4, R5, L4, L3, L1, L5, L1, R1, R2, L1, R3, R4, R5, R2, R3, L2, L1, L5
`;

const tokens = input.trim().split(', ');

function parseCommand(token) {
  return {
    rotate: token[0],
    forward: +token.slice(1),
  };
}

const commands = tokens.map(parseCommand);

var x = 0, y = 0; // position
var fx = 1, fy = 0; // facing
var seen = [];
outer:
for (const command of commands) {

  if (command.rotate === 'L') {
    [fx, fy] = [-fy, fx];
  } else {
    [fx, fy] = [fy, -fx];
  }

  for (let i=0; i<command.forward; ++i) {
    if (seen.find(stateMatching({ x, y, fx, fy }))) {
      // This is the first location we've visited twice!
      break outer;
    } else {
      seen = [...seen, { x, y, fx, fy }];
    }
    x += fx;
    y += fy;
  }
}


function stateMatching(s1) {
  return function(s2) {
    // actually we only want to compare positions
    return (
      s1.x === s2.x &&
      s1.y === s2.y
    );
  };
}


const dist = Math.abs(x) + Math.abs(y);
dist;

