import { LangtailNode } from './langtailNode';

const lt = new LangtailNode({

  baseURL: 'https://proxy.langtail.com/v1',
  apiKey: 'lt-eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJpc3MiOiJsYW5ndGFpbC1hcGkiLCJzdWIiOiJjbHMxamQ0dGkwMDA3bDAwOHN6dWloODF0IiwianRpIjoiY2x0eDQ1dDcxMDAwM2swMGd6dTFoOG1ycCIsInJhdGVMaW1pdCI6bnVsbCwiaWF0IjoxNzEwNzc2NTA3fQ.BBY_PztlTc6bJI6Xyp_xgU4gihujf7qQOHRM22EEmt2qaFd6u2twzvHZ8s4VOZ-Pv2Ue6kRGixOkNNdcUv3G5g',
});


async function main() {

  // Easy proxy
  const proxyCompletion = await lt.chat.completions.create({
    // Required
    messages: [{ role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "What is the weather like?" }
    ],
    model: "gpt-3.5-turbo",
    // Optional:
    // All OpenAI fields (temperature, top_p, tools,...) 
    // prompt: "<prompt-slug>",
    // doNotRecord: false,
    // metadata: {
    //   "custom-field": 1
    // },
  });
  console.log(proxyCompletion)
  // Deployed prompt
  // const deployedCompletion = await lt.prompts.chat.create({
  //   deploymentUrl: "<full-URL>",
  //   variables: {
  //     varName: "<value>",
  //   },
  //   // Optional:
  //   // All OpenAI fields (temperature, top_p, tools,...)
  //   messages: [{ role: "user", content: "My message" }],
  //   doNotRecord: false,
  //   metadata: {
  //     "custom-field": 1
  //   },
  // });
}

main();
