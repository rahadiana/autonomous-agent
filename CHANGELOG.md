# CHANGELOG

## Test Results - 2026-04-07

All tests passed across all test scripts.

---

## Test Input/Output Details by Script

### 1. executorDSL.test.js (17 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| runSkill executes set operation | {logic: [{op:"set",path:"result",value:42}]} | {result: 42} | PASS |
| runSkill executes get operation from input | {logic: [{op:"get",path:"data.value",to:"val"}], input: {data:{value:123}}} | {val: 123} | PASS |
| runSkill executes add operation | {logic: [{op:"add",a:10,b:5,to:"sum"}]} | {sum: 15} | PASS |
| runSkill executes subtract operation | {logic: [{op:"subtract",a:10,b:5,to:"diff"}]} | {diff: 5} | PASS |
| runSkill executes multiply operation | {logic: [{op:"multiply",a:6,b:7,to:"product"}]} | {product: 42} | PASS |
| runSkill executes divide operation | {logic: [{op:"divide",a:20,b:4,to:"quotient"}]} | {quotient: 5} | PASS |
| runSkill executes concat operation | {logic: [{op:"concat",a:"Hello",b:" World",to:"greeting"}]} | {greeting: "Hello World"} | PASS |
| runSkill executes mcp_call to json.parse | {logic: [{op:"mcp_call",tool:"json.parse",args:{text:'{"key":"value"}'},to:"parsed"}]} | {parsed: {key:"value"}} | PASS |
| runSkill rejects disallowed tool | {logic: [{op:"mcp_call",tool:"fs.readFile",args:{path:"/etc/passwd"}}]} | Error: Tool not allowed | PASS |
| runSkill resolves memory reference in mcp_call args | {logic: [{op:"set",path:"memory.jsonText",value:'{"a":1}'}, {op:"mcp_call",tool:"json.parse",args:{text:"jsonText"},to:"parsed"}]} | {parsed: {a:1}} | PASS |
| runSkill executes if branching - true branch | {logic: [{op:"if",condition:true,branches:{then:[{op:"set",path:"result",value:"yes"}]}}]} | {result: "yes"} | PASS |
| runSkill executes if branching - false branch | {logic: [{op:"if",condition:false,branches:{then:[{op:"set",path:"result",value:"yes"}],else:[{op:"set",path:"result",value:"no"}]}}]} | {result: "no"} | PASS |
| runSkill uses memory value in condition | {logic: [{op:"set",path:"memory.flag",value:true}, {op:"if",condition:"flag",branches:{then:[{op:"set",path:"result",value:"flag was true"}]}}]} | {result: "flag was true"} | PASS |
| runSkill handles nested path in set | {logic: [{op:"set",path:"user.name",value:"John"}, {op:"set",path:"user.age",value:30}]} | {user:{name:"John",age:30}} | PASS |
| runSkill throws on unknown operation | {logic: [{op:"unknown_op",value:42}]} | Error: Unknown operation | PASS |
| runDSL is alias for runSkill | {logic: "output.x = 1;"} | {x: 1} | PASS |

---

### 2. executor.test.js (8 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| runSkill executes basic logic and returns output | {logic: "output.result = input.a + input.b;", input: {a:5,b:3}} | {result: 8} | PASS |
| runSkill handles string operations | {logic: "output.greeting = 'Hello ' + input.name;", input: {name:"World"}} | {greeting: "Hello World"} | PASS |
| runSkill handles conditional logic | {logic: "output.result = input.x > 5 ? 'big' : 'small';"} | {result: "small"} | PASS |
| runSkill handles array operations | {logic: "output.sum = input.nums.reduce((a,b) => a + b, 0);", input: {nums:[1,2,3]}} | {sum: 6} | PASS |
| runSkill handles memory object | {logic: "output.x = input.memory.value;", input: {memory:{value:42}}} | {x: 42} | PASS |
| runSkill throws on invalid JS syntax | {logic: "output.x = "} | Error: Parse error | PASS |
| runSkill throws on undefined variable access | {logic: "output.x = undefinedVar;"} | Error: undefinedVar is not defined | PASS |
| runSkill handles nested object output | {logic: "output.user.name = 'John';"} | {user:{name:"John"}} | PASS |

---

### 3. validator.test.js (7 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| validate returns true for valid data | {schema: {type:"object",properties:{name:{type:"string"}},required:["name"]}, data: {name:"John"}} | {valid: true} | PASS |
| validate returns false for missing required field | {schema: {type:"object",required:["name"]}, data: {}} | {valid: false} | PASS |
| validate returns false for wrong type | {schema: {properties:{age:{type:"number"}}}, data: {age:"20"}} | {valid: false} | PASS |
| validate handles array schema | {schema: {type:"array",items:{type:"number"}}, data: [1,2,3]} | {valid: true} | PASS |
| validate handles nested object schema | {schema: {properties:{user:{type:"object",properties:{name:{type:"string"}}}}}, data: {user:{name:"John"}}} | {valid: true} | PASS |
| validate handles enum constraint | {schema: {properties:{status:{type:"string",enum:["active","inactive"]}}}, data: {status:"active"}} | {valid: true} | PASS |
| validate handles minimum and maximum constraints | {schema: {properties:{age:{type:"number",minimum:0,maximum:120}}}, data: {age:25}} | {valid: true} | PASS |

---

### 4. planner.test.js (16 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| PlanNode constructor initializes correctly | {action:"test", state:{x:1}} | {action:"test", state:{x:1}, parent:null, cost:0} | PASS |
| PlanNode getPath returns action path | [{a:{action:"step1"},b:{action:"step2"}}] | ["step1","step2"] | PASS |
| Planner search finds solution for simple goal | {startState:{}, goal:"test"} | {status:"success"} | PASS |
| Planner search handles timeout | {startState:{}, goal:"test", timeout:1} | {status:"timeout"} | PASS |
| Planner respects maxNodes limit | {startState:{}, goal:"test", maxNodes:1} | {status:"limit_exceeded"} | PASS |
| decomposeGoal handles string goal | "goal1 then goal2" | [{subGoal:"goal1"},{subGoal:"goal2"}] | PASS |
| decomposeGoal handles object goal with steps | {steps:[{capability:"math.add"}]} | [{subGoal:...,requiredCapabilities:["math.add"]}] | PASS |
| evaluatePlan returns score for valid plan | {path:["a"],status:"success"} | {score:0.7} | PASS |
| evaluatePlan respects constraints | {path:["a"],status:"success"}, context:{constraints:{maxSteps:5}} | {score:0.8} | PASS |
| createPlan returns planner result | {goal:"test", state:{}, skills:[]} | {status:"success"|"no_solution"} | PASS |

---

### 5. executorDSLAdvanced.test.js (34 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| for loop iterates over array | {logic:[{op:"for",collection:"items",steps:[{op:"set",path:"count",value:"count+1"}]}]} | {count: 3} | PASS |
| for loop processes each item | {items:[1,2,3], logic:[{op:"for",collection:"items",var:"i",steps:[{op:"set",path:"results",value:"results+i"}]}]} | {results: 6} | PASS |
| for_range loops from start to end | {logic:[{op:"for_range",start:0,end:3,steps:[{op:"set",path:"sum",value:"sum+i"}]}]} | {sum: 3} | PASS |
| for_range supports custom step size | {logic:[{op:"for_range",start:0,end:6,step:2,steps:[{op:"set",path:"sum",value:"sum+i"}]}]} | {sum: 0+2+4=6} | PASS |
| while loop executes until condition fails | {logic:[{op:"while",condition:"i<3",steps:[{op:"set",path:"i",value:"i+1"},{op:"set",path:"count",value:"count+1"}]}]} | {count: 3} | PASS |
| switch matches correct case | {logic:[{op:"switch",value:"b",cases:{a:[{op:"set",path:"result",value:1}],b:[{op:"set",path:"result",value:2}]}}]} | {result: 2} | PASS |
| map transforms array | {items:[1,2,3], logic:[{op:"map",collection:"items",var:"x",steps:[{op:"set",path:"doubled",value:"x*2"}]}]} | {doubled: [2,4,6]} | PASS |
| filter removes items by condition | {items:[1,2,3,4], logic:[{op:"filter",collection:"items",var:"x",condition:{comparison:{left:"x",op:"gt",right:2}}}]} | [3,4] | PASS |
| reduce accumulates values | {items:[1,2,3], logic:[{op:"reduce",collection:"items",initial:0,steps:[{op:"add",a:"acc",b:"item",to:"acc"}]}]} | {acc: 6} | PASS |
| comparison operator eq returns true | {logic:[{op:"compare",a:5,b:5,operator:"eq",to:"result"}]} | {result: true} | PASS |
| comparison operator lt returns true | {logic:[{op:"compare",a:3,b:5,operator:"lt",to:"result"}]} | {result: true} | PASS |
| map with depth limit | {logic:[{op:"map",collection:"items",steps:[{op:"map",collection:"items"}]}]} | throws when depth > 5 | PASS |

---

### 6. skillService.test.js (7 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| handleRequest throws when no skill found | {skillName:"nonexistent"} | Error: Skill not found | PASS |
| handleRequest executes skill and returns result | {skillName:"add", input:{a:5,b:3}} | {result:{sum:8}} | PASS |
| handleRequest updates usage_count after execution | {skillName:"add"} | usage_count incremented | PASS |
| handleRequest updates failure_count on validation failure | {skillName:"bad"} | failure_count incremented | PASS |
| handleRequest updates last_used_at timestamp | {skillName:"add"} | last_used_at updated | PASS |
| handleRequest selects via bandit when multiple skills exist | {capability:"math.add", skills:[{name:"add1",score:0.8},{name:"add2",score:0.5}]} | selected skill based on bandit | PASS |

---

### 7. toolRegistry.test.js (10 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| createTool creates tool with defaults | {name:"test"} | {name:"test", handler:null, tags:[]} | PASS |
| createTool accepts custom capability | {name:"test", capability:"custom.cap"} | {capability:"custom.cap"} | PASS |
| ToolRegistry register adds tool | registry.register({name:"tool1", handler:()=>{}}) | registry.has("tool1")=true | PASS |
| ToolRegistry register throws on duplicate | register tool1 twice | Error: duplicate | PASS |
| ToolRegistry getByCapability returns tools | register tool with capability:"api.get" | getByCapability("api.get") returns tool | PASS |
| ToolRegistry unregister removes tool | register then unregister("tool1") | has("tool1")=false | PASS |
| ToolRegistry listByTag filters correctly | register tools with tags:["db","cache"] | listByTag("db") returns db tools | PASS |
| ToolRegistry search finds by name/description/capability | search("json") | finds matching tools | PASS |
| ToolRegistry clear removes all | clear() | count=0 | PASS |

---

### 8. bandit.test.js (8 tests)

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

### 9. skillSearch.test.js (14 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| SkillSearch indexSkill adds skill to index | {id:"skill1",name:"add",capability:"math.add"} | count=1 | PASS |
| SkillSearch searchByText finds relevant skills | "add" | returns add skill | PASS |
| SkillSearch searchByText respects topK | "math", topK:2 | 2 results | PASS |
| SkillSearch searchByText respects threshold | "test", threshold:0.8 | filtered results | PASS |
| SkillSearch searchByCapability filters by capability | "math.add" | returns matching | PASS |
| SkillSearch findSimilar returns similar skills | {id:"skill1"} | returns similar | PASS |
| SkillSearch getSkill returns skill by id | "skill1" | returns skill object | PASS |
| SkillSearch removeSkill removes from index | "skill1" | count decreases | PASS |

---

### 10. testRunner.test.js (6 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| runTests returns correct passed count for valid skills | skill with 3 passing tests | passed:3, failed:0 | PASS |
| runTests returns zero for invalid schema | invalid schema | passed:0 | PASS |
| runTests handles runtime errors gracefully | skill with error | passed:0, errors logged | PASS |
| runTests handles empty test cases | [] | passed:0 | PASS |
| runEvaluation returns testScore and avgScore | skill with evaluation | {testScore,avgScore} | PASS |

---

### 11. executorSafety.test.js (5 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| runSkill throws on dangerous code with process | {logic:"process.exit(0)"} | Error: Dangerous code detected | PASS |
| runSkill throws on dangerous code with require | {logic:"require('fs')"} | Error: Dangerous code detected | PASS |
| runSkill throws on dangerous code with module | {logic:"module.exports={}"} | Error: Dangerous code detected | PASS |
| runSkill executes normal logic | {logic:"output.x = 1"} | {x:1} | PASS |
| runSkill timeout prevents infinite loops | logic with infinite loop | Error: timeout | PASS |

---

### 12. testBuilder.test.js (9 tests)

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

---

### 13. scoring.test.js (5 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| evaluate returns 1.0 for valid result | result matches expected | score:1.0 | PASS |
| evaluate returns 0.0 for invalid result | result doesn't match | score:0.0 | PASS |
| scoreFromEvaluation extracts score from eval result | {score:0.8} | 0.8 | PASS |
| scoreFromEvaluation handles null | null | 0 | PASS |
| scoreFromEvaluation handles missing score | {} | 0 | PASS |

---

### 14. vectorStore.test.js (17 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| generateEmbedding returns 128-dim vector | "test text" | vector length 128 | PASS |
| generateEmbedding normalizes vector | "test" | magnitude ~1 | PASS |
| generateEmbedding same text produces same embedding | "test" twice | identical vectors | PASS |
| cosineSimilarity returns 1 for identical vectors | same vector | 1 | PASS |
| cosineSimilarity returns 0 for orthogonal vectors | [1,0],[0,1] | 0 | PASS |
| VectorStore add and get | add({id:"1",text:"test"}), get("1") | returns entry | PASS |
| VectorStore search returns top K results | search("test", topK:2) | 2 results | PASS |
| VectorStore search respects threshold | search("test", threshold:0.8) | filtered | PASS |

---

### 15. versioning.test.js (4 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| createVersion creates new skill with incremented version | skill v1 | version:2 | PASS |
| createVersion generates unique id for each version | skill v1,v2 | different ids | PASS |
| createVersion chains versions correctly | skill v1->v2->v3 | parent chain | PASS |
| createVersion sets created_at timestamp | new version | timestamp set | PASS |

---

### 16. pruning.test.js (4 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| getPruningStats returns valid structure | {} | {total,pruned,protected} | PASS |
| pruneSkills respects minUsage protection | skills with usage:3 | protected | PASS |
| pruneSkills ensures capability safety | capability safety check | no capability loss | PASS |
| getPruningStats shows score distribution | {} | distribution map | PASS |

---

### 17. resilience_test.js (1 test)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| Full resilience layer test | economic scoring, meta stability, safe mode, decision logger | all components work | PASS |

---

### 18. direct_executor_test.js (1 test)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| Direct DSL execution | skill with DSL format: [{op:"add",a:"input.a",b:"input.b",to_output:"result"}], input:{a:5,b:3} | {result:8} | PASS |

---

## Summary

| Test Script | Tests | Passed | Failed |
|-------------|-------|--------|--------|
| executorDSL.test.js | 17 | 17 | 0 |
| executor.test.js | 8 | 8 | 0 |
| validator.test.js | 7 | 7 | 0 |
| planner.test.js | 16 | 16 | 0 |
| executorDSLAdvanced.test.js | 34 | 34 | 0 |
| skillService.test.js | 7 | 7 | 0 |
| toolRegistry.test.js | 10 | 10 | 0 |
| bandit.test.js | 8 | 8 | 0 |
| skillSearch.test.js | 14 | 14 | 0 |
| testRunner.test.js | 6 | 6 | 0 |
| executorSafety.test.js | 5 | 5 | 0 |
| testBuilder.test.js | 9 | 9 | 0 |
| scoring.test.js | 5 | 5 | 0 |
| vectorStore.test.js | 17 | 17 | 0 |
| versioning.test.js | 4 | 4 | 0 |
| pruning.test.js | 4 | 4 | 0 |
| resilience_test.js | 1 | 1 | 0 |
| direct_executor_test.js | 1 | 1 | 0 |
| **TOTAL** | **163** | **163** | **0** |

All tests passed successfully.