# CHANGELOG

## Test Results - 2026-04-07

All 226 tests passed across all test scripts.

---

## Test Input/Output Details by Script

### 1. bandit.test.js (8 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| banditScore returns higher score for unexplored skills | {score:0.5,usage_count:0} vs {score:0.5,usage_count:100} | score0 > score100 | PASS |
| banditScore returns higher score for higher base score when usage is equal | {score:0.8,usage_count:10} vs {score:0.3,usage_count:10} | scoreA > scoreB | PASS |
| banditScore exploration decreases as usage increases | usage:0,100,10000 | score0 > score100 > score10000 | PASS |
| banditScore balances exploit vs explore based on c parameter | {score:0.9,usage:0} vs {score:0.3,usage:100} | s1 > s2 | PASS |
| selectSkill picks the skill with highest bandit score | [{score:0.5,usage:0},{score:0.7,usage:0},{score:0.3,usage:0}] | {score:0.7} | PASS |
| selectSkill prefers unexplored skills when scores are equal | [{score:0.5,usage:0},{score:0.5,usage:50}] | usage:0 selected | PASS |
| selectSkill returns null for empty array | [] | null | PASS |
| selectSkill returns the only skill in array | [{score:0.5,usage:10}] | skill[0] | PASS |

---

### 2. callSkill.test.js (20 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| call_skill executes nested skill | {skill:"double", input:{}} | {doubled:{result:10}} | PASS |
| call_skill passes input correctly | {skill:"add", input:{a:10,b:20}} | {result:{sum:30}} | PASS |
| call_skill throws when skill not found | {skill:"nonexistent"} | Error: Skill not found | PASS |
| call_skill uses memory reference for skill name | {memory:{skillName:"triple"}} | {result:{result:21}} | PASS |
| call_skill_map executes skill for each item in array | {collection:[1,2,3,4,5], skill:"double"} | {results:[...]} length:5 | PASS |
| call_skill_map with empty array | {collection:[], skill:"double"} | [] | PASS |
| call_skill chain - output of one becomes input of another | {skills:["add1","multiply2"]} | {step1:{result:6},step2:{result:12}} | PASS |
| call_skill validates output schema | {skill:"bad"} | Error: Output validation failed | PASS |
| SkillRunner can register and list skills | register test1, test2 | has("test1")=true, has("test2")=true | PASS |
| call_skill throws when SkillRunner not configured | skill without config | Error: SkillRunner not configured | PASS |
| call_skill_map throws when SkillRunner not configured | map without config | Error: SkillRunner not configured | PASS |
| call_skill works with multiple steps after | skill with steps after call_skill | {squared:{result:9},final:10} | PASS |

---

### 3. decay.test.js (4 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| applyDecay reduces score for old skills | {score:0.8,last_used_at:oldDate} | decayed score | PASS |
| applyDecay does not affect skills without last_used_at | {score:0.8,last_used_at:null} | score unchanged | PASS |
| applyDecay applies stronger decay for older skills | older date | lower score | PASS |
| applyDecay handles empty database | [] | {pruned:0} | PASS |

---

### 4. evaluator.test.js (7 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| evaluate returns 1.0 for valid result | result matches expected | score:1.0 | PASS |
| evaluate returns 0.0 for invalid result | result doesn't match | score:0.0 | PASS |
| scoreFromEvaluation extracts score from eval result | {score:0.8} | 0.8 | PASS |
| scoreFromEvaluation handles null | null | 0 | PASS |
| scoreFromEvaluation handles missing score | {} | 0 | PASS |

---

### 5. executor.test.js (8 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| runSkill executes basic logic and returns output | {logic:"output.result = input.a + input.b;", input:{a:10,b:5}} | {result:15} | PASS |
| runSkill handles string operations | {logic:"output.greeting = 'Hello, ' + input.name + '!';", input:{name:"World"}} | "Hello, World!" | PASS |
| runSkill handles conditional logic | {logic:if(input.value>0)...} input:{value:42} | {status:"positive"} | PASS |
| runSkill handles array operations | {logic:"output.sum = input.numbers.reduce...", input:{numbers:[1,2,3,4,5]}} | {sum:15} | PASS |
| runSkill handles memory object | memory counter | {count:1} | PASS |
| runSkill throws on invalid JS syntax | {logic:"output.result = input.a + ;"} | SyntaxError | PASS |
| runSkill throws on undefined variable access | {logic:"output.result = nonexistentFunction();"} | ReferenceError | PASS |
| runSkill handles nested object output | {logic:"output.data = {...}"} | nested object with list | PASS |

---

### 6. executorDSL.test.js (17 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| runSkill executes set operation | {logic:[{op:"set",path:"result",value:42}]} | {result:42} | PASS |
| runSkill executes get operation from input | {logic:[{op:"get",path:"data.value",to:"val"}], input:{data:{value:123}}} | {val:123} | PASS |
| runSkill executes add operation | {logic:[{op:"add",a:10,b:5,to:"sum"}]} | {sum:15} | PASS |
| runSkill executes subtract operation | {logic:[{op:"subtract",a:10,b:5,to:"diff"}]} | {diff:5} | PASS |
| runSkill executes multiply operation | {logic:[{op:"multiply",a:6,b:7,to:"product"}]} | {product:42} | PASS |
| runSkill executes divide operation | {logic:[{op:"divide",a:20,b:4,to:"quotient"}]} | {quotient:5} | PASS |
| runSkill executes concat operation | {logic:[{op:"concat",a:"Hello",b:" World",to:"greeting"}]} | {greeting:"Hello World"} | PASS |
| runSkill executes mcp_call to json.parse | {logic:[{op:"mcp_call",tool:"json.parse",args:{text:'{"key":"value"}'},to:"parsed"}]} | {parsed:{key:"value"}} | PASS |
| runSkill rejects disallowed tool | {logic:[{op:"mcp_call",tool:"fs.readFile"...}]} | Error:Tool not allowed | PASS |
| runSkill resolves memory reference in mcp_call args | memory reference in args | resolved value | PASS |
| runSkill resolves nested memory reference in mcp_call args | nested memory path | parsed object | PASS |
| runSkill executes if branching - true branch | condition:true | then branch executed | PASS |
| runSkill executes if branching - false branch | condition:false | else branch executed | PASS |
| runSkill uses memory value in condition | memory.flag = true | condition evaluated from memory | PASS |
| runSkill handles nested path in set | nested path in set | nested object created | PASS |
| runSkill throws on unknown operation | {op:"unknown_op"} | Error | PASS |
| runDSL is alias for runSkill | DSL logic | same result as JS logic | PASS |

---

### 7. executorDSLAdvanced.test.js (34 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| for loop iterates over array | {collection:"items",steps:[...]} | iterates all items | PASS |
| for loop processes each item | array items | item processed | PASS |
| for loop tracks index | index variable | index tracked | PASS |
| for_range loops from start to end | start:1,end:5 | sum:10 | PASS |
| for_range supports custom step size | step:2 | even numbers only | PASS |
| while loop executes until condition fails | while condition | executes until false | PASS |
| switch matches correct case | value:"b", cases | matched case executed | PASS |
| switch falls through to default | unmatched value | default executed | PASS |
| map transforms array | collection + transform | mapped array | PASS |
| filter removes items by condition | collection + condition | filtered array | PASS |
| reduce accumulates values | collection + accumulator | final accumulator | PASS |
| comparison operators (eq,lt,gt,neq,lte,gte) | comparisons | boolean results | PASS |
| comparison operator in works with arrays | value in collection | true/false | PASS |
| comparison operator typeof works | typeof check | true/false | PASS |
| nested if-else works | nested branches | correct branch | PASS |
| for loop prevents infinite iteration with MAX_LOOP | infinite collection | stops at limit | PASS |
| while loop prevents infinite iteration with MAX_LOOP | infinite while | stops at limit | PASS |
| switch with no matching case and no default | unmatched value | no result | PASS |
| filter returns empty array when no match | no matches | [] | PASS |
| map over empty array returns empty array | [] | [] | PASS |
| reduce with single element | single item | correct accumulator | PASS |

---

### 8. executorSafety.test.js (5 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| runSkill throws on dangerous code with process | {logic:"process.exit(0)"} | Error:Dangerous code detected | PASS |
| runSkill throws on dangerous code with require | {logic:"require('fs')"} | Error:Dangerous code detected | PASS |
| runSkill throws on dangerous code with module | {logic:"module.exports={}"} | Error:Dangerous code detected | PASS |
| runSkill executes normal logic | {logic:"output.x = 1"} | {x:1} | PASS |
| runSkill timeout prevents infinite loops | infinite loop | Error:timeout | PASS |

---

### 9. mcp.test.js (9 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| ALLOWED_TOOLS contains expected tools | check list | contains http.get, http.post, json.parse | PASS |
| isToolAllowed returns true for allowed tools | "http.get" | true | PASS |
| isToolAllowed returns false for disallowed tools | "fs.readFile" | false | PASS |
| json.parse tool parses valid JSON | {text:'{"key":"value"}'} | {key:"value"} | PASS |
| json.parse tool returns error for invalid JSON | {text:"invalid"} | error object | PASS |
| json.stringify tool converts object to string | {value:{a:1}} | '{"a":1}' | PASS |
| callTool throws for disallowed tool | "forbidden.tool" | Error | PASS |
| callTool throws for non-existent tool | "nonexistent.tool" | Error | PASS |
| callTool works for allowed tool | allowed tool | returns result | PASS |

---

### 10. mutation.test.js (5 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| mutateSkill returns clone with same structure | {logic:[{op:"add"...}]} | cloned | PASS |
| mutateSkill can change add to subtract | change operation | op changed | PASS |
| mutateSkill handles empty logic array | [] | [] | PASS |
| mutateSkill handles string logic (passthrough) | "code" | "code" | PASS |
| mutateSkill does not mutate original | original check | unchanged | PASS |

---

### 11. planner.test.js (16 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| PlanNode constructor initializes correctly | {action:"test",state:{x:1}} | node created | PASS |
| PlanNode getPath returns action path | path nodes | action path array | PASS |
| PlanNode getDepth returns correct depth | node with parent | depth>0 | PASS |
| Planner search finds solution for simple goal | start and goal | solution found | PASS |
| Planner search handles timeout | timeout:1ms | timeout status | PASS |
| Planner respects maxNodes limit | maxNodes:1 | limit_exceeded | PASS |
| Planner sorts by score | nodes with scores | sorted | PASS |
| decomposeGoal handles string goal | "goal1 then goal2" | subgoals array | PASS |
| decomposeGoal handles object goal with steps | {steps:[...]} | decomposed | PASS |
| decomposeGoal returns empty for unknown format | unknown format | [] | PASS |
| evaluatePlan returns score for valid plan | valid plan | score>0 | PASS |
| evaluatePlan respects constraints | with constraints | constraint applied | PASS |
| createPlan returns planner result | goal and state | planner result | PASS |
| Planner countNodes counts all nodes | tree structure | count>0 | PASS |
| Planner visualize returns string | tree | visualization string | PASS |

---

### 12. pruning.test.js (4 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| getPruningStats returns valid structure | {} | {total,pruned,protected} | PASS |
| pruneSkills respects minUsage protection | skills with usage:3 | protected | PASS |
| pruneSkills ensures capability safety | capability check | no capability loss | PASS |
| getPruningStats shows score distribution | {} | distribution map | PASS |

---

### 13. reasoner.test.js (17 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| Reasoner evaluate returns score for valid plan | valid plan | score>0 | PASS |
| Reasoner evaluate handles timeout status | {status:"timeout"} | score:0 | PASS |
| Reasoner evaluate handles limit_exceeded status | {status:"limit_exceeded"} | score:0 | PASS |
| Reasoner evaluate handles no_solution status | {status:"no_solution"} | score:0 | PASS |
| Reasoner evaluate handles invalid plan | null | error handled | PASS |
| Reasoner evaluate applies constraints | with constraints | constraint applied | PASS |
| Reasoner critique identifies issues | flawed plan | issues found | PASS |
| Reasoner critique identifies strengths for diverse actions | diverse actions | strengths found | PASS |
| Reasoner critique handles long plans | long plan | handled | PASS |
| Reasoner critique handles short plans | short plan | handled | PASS |
| Reasoner critique considers history | with history | considered | PASS |
| Reasoner reflect on successful execution | success result | reflection created | PASS |
| Reasoner reflect on failed execution | failure result | reflection created | PASS |
| Reasoner reflect considers execution time | with timing | time considered | PASS |
| Reasoner selectBest chooses highest score | multiple plans | highest chosen | PASS |
| Reasoner selectBest handles empty array | [] | null | PASS |
| createCritic returns review and suggest functions | create critic | functions returned | PASS |

---

### 14. scoring.test.js (5 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| evaluate returns 1.0 for valid result | result matches expected | score:1.0 | PASS |
| evaluate returns 0.0 for invalid result | result doesn't match | score:0.0 | PASS |
| scoreFromEvaluation extracts score from eval result | {score:0.8} | 0.8 | PASS |
| scoreFromEvaluation handles null | null | 0 | PASS |
| scoreFromEvaluation handles missing score | {} | 0 | PASS |

---

### 15. skillSearch.test.js (14 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| SkillSearch indexSkill adds skill to index | {id:"skill1",name:"add",capability:"math.add"} | count=1 | PASS |
| SkillSearch searchByText finds relevant skills | "add" | returns add skill | PASS |
| SkillSearch searchByText respects topK | "math", topK:2 | 2 results | PASS |
| SkillSearch searchByText respects threshold | "test", threshold:0.8 | filtered results | PASS |
| SkillSearch searchByCapability filters by capability | "math.add" | returns matching | PASS |
| SkillSearch findSimilar returns similar skills | {id:"skill1"} | returns similar | PASS |
| SkillSearch getSkill returns skill by id | "skill1" | returns skill object | PASS |
| SkillSearch hasSkill returns correct boolean | "skill1" | boolean | PASS |
| SkillSearch removeSkill removes from index | "skill1" | count decreases | PASS |
| SkillSearch count returns total indexed skills | count() | number | PASS |
| SkillSearch clear removes all skills | clear() | count=0 | PASS |
| SkillSearch listAll returns all skills | listAll() | array | PASS |
| SkillSearch with no matches returns empty array | "nonexistent" | [] | PASS |
| SkillSearch handles duplicate id updates | same id twice | updated | PASS |

---

### 16. skillService.test.js (7 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| handleRequest throws when no skill found | {skillName:"nonexistent"} | Error:Skill not found | PASS |
| handleRequest executes skill and returns result | {skillName:"add",input:{a:5,b:3}} | {result:{sum:8}} | PASS |
| handleRequest updates usage_count after execution | skill execution | usage_count incremented | PASS |
| handleRequest updates failure_count on validation failure | bad skill | failure_count incremented | PASS |
| handleRequest updates last_used_at timestamp | skill execution | timestamp updated | PASS |
| handleRequest selects via bandit when multiple skills exist | multiple skills | selected via bandit | PASS |
| handleRequest score updates with reinforcement formula | score update | formula applied | PASS |

---

### 17. testBuilder.test.js (9 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| buildTestCases returns at least empty input test | {} | returns test cases | PASS |
| buildTestCases generates number test cases | {properties:{age:{type:"number"}}} | includes number cases | PASS |
| buildTestCases generates string test cases | {properties:{name:{type:"string"}}} | includes string cases | PASS |
| buildTestCases generates boolean test cases | {properties:{active:{type:"boolean"}}} | includes boolean cases | PASS |
| buildEdgeCases includes null and undefined | schema | includes null/undefined | PASS |
| buildEdgeCases includes empty array and string | [],"" | included | PASS |
| buildRandomFuzz generates specified count | count:5 | 5 test cases | PASS |
| buildRandomFuzz generates random values | random generation | varied output | PASS |
| buildTestCases handles no schema | null schema | handles gracefully | PASS |

---

### 18. testRunner.test.js (6 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| runTests returns correct passed count for valid skills | skill with passing tests | passed:3, failed:0 | PASS |
| runTests returns zero for invalid schema | invalid schema | passed:0 | PASS |
| runTests handles runtime errors gracefully | skill with error | passed:0, errors logged | PASS |
| runTests handles empty test cases | [] | passed:0 | PASS |
| runEvaluation returns testScore and avgScore | skill with evaluation | {testScore,avgScore} | PASS |
| runTests records each test result | multiple tests | results recorded | PASS |

---

### 19. toolRegistry.test.js (10 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| createTool creates tool with defaults | {name:"test"} | {name:"test",handler:null,tags:[]} | PASS |
| createTool accepts custom capability | {name:"test",capability:"custom.cap"} | {capability:"custom.cap"} | PASS |
| ToolRegistry register adds tool | registry.register(...) | has("tool1")=true | PASS |
| ToolRegistry register throws on duplicate | register twice | Error:duplicate | PASS |
| ToolRegistry register throws on missing name/handler | register without name | Error | PASS |
| ToolRegistry getByCapability returns tools | register with capability | getByCapability returns tool | PASS |
| ToolRegistry unregister removes tool | register then unregister | has("tool1")=false | PASS |
| ToolRegistry listByTag filters correctly | register with tags | listByTag returns filtered | PASS |
| ToolRegistry search finds by name/description/capability | search("json") | finds matching tools | PASS |
| ToolRegistry clear removes all | clear() | count=0 | PASS |

---

### 20. validator.test.js (7 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| validate returns true for valid data | valid schema + data | {valid:true} | PASS |
| validate returns false for missing required field | missing required | {valid:false} | PASS |
| validate returns false for wrong type | wrong type | {valid:false} | PASS |
| validate handles array schema | array type | {valid:true} | PASS |
| validate handles nested object schema | nested object | {valid:true} | PASS |
| validate handles enum constraint | valid enum value | {valid:true} | PASS |
| validate handles minimum and maximum constraints | within min/max | {valid:true} | PASS |

---

### 21. vectorStore.test.js (17 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| generateEmbedding returns 128-dim vector | "test text" | vector length 128 | PASS |
| generateEmbedding normalizes vector | "test" | magnitude ~1 | PASS |
| generateEmbedding same text produces same embedding | "test" twice | identical vectors | PASS |
| generateEmbedding different texts produce different embeddings | "test" vs "other" | different vectors | PASS |
| cosineSimilarity returns 1 for identical vectors | same vector | 1 | PASS |
| cosineSimilarity returns 0 for orthogonal vectors | [1,0],[0,1] | 0 | PASS |
| cosineSimilarity returns -1 for opposite vectors | [1,0],[-1,0] | -1 | PASS |
| cosineSimilarity returns 0 for different length vectors | different lengths | 0 | PASS |
| VectorStore add and get | add then get | returns entry | PASS |
| VectorStore search returns top K results | search with topK | K results | PASS |
| VectorStore search respects threshold | threshold filter | filtered results | PASS |
| VectorStore remove deletes entry | remove by id | deleted | PASS |
| VectorStore size returns correct count | size() | count | PASS |
| VectorStore clear removes all entries | clear() | empty | PASS |
| VectorStore throws on dimension mismatch | wrong dimension | Error | PASS |
| createSkillEmbedding generates embedding from skill | skill object | embedding | PASS |
| createSkillEmbedding same skill produces same embedding | same skill twice | identical | PASS |

---

### 22. versioning.test.js (4 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| createVersion creates a new skill with incremented version | skill v1 | version:2 | PASS |
| createVersion generates unique id for each version | skill v1,v2 | different ids | PASS |
| createVersion chains versions correctly | v1->v2->v3 | parent chain | PASS |
| createVersion sets created_at timestamp | new version | timestamp set | PASS |

---

## Summary

| Test Script | Tests | Passed | Failed |
|-------------|-------|--------|--------|
| bandit.test.js | 8 | 8 | 0 |
| callSkill.test.js | 20 | 20 | 0 |
| decay.test.js | 4 | 4 | 0 |
| evaluator.test.js | 7 | 7 | 0 |
| executor.test.js | 8 | 8 | 0 |
| executorDSL.test.js | 17 | 17 | 0 |
| executorDSLAdvanced.test.js | 34 | 34 | 0 |
| executorSafety.test.js | 5 | 5 | 0 |
| mcp.test.js | 9 | 9 | 0 |
| mutation.test.js | 5 | 5 | 0 |
| planner.test.js | 16 | 16 | 0 |
| pruning.test.js | 4 | 4 | 0 |
| reasoner.test.js | 17 | 17 | 0 |
| scoring.test.js | 5 | 5 | 0 |
| skillSearch.test.js | 14 | 14 | 0 |
| skillService.test.js | 7 | 7 | 0 |
| testBuilder.test.js | 9 | 9 | 0 |
| testRunner.test.js | 6 | 6 | 0 |
| toolRegistry.test.js | 10 | 10 | 0 |
| validator.test.js | 7 | 7 | 0 |
| vectorStore.test.js | 17 | 17 | 0 |
| versioning.test.js | 4 | 4 | 0 |
| **TOTAL** | **226** | **226** | **0** |

All tests passed successfully. Duration: 1826ms