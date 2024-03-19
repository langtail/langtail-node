
import OpenAI from "openai";
import * as Core from "openai/core";
import { Langtail } from "./Langtail";



export class LangtailNode extends OpenAI {
  langtail: Langtail;

  constructor(private options: {
    apiKey: string,
    baseURL?: string
  } = {
    apiKey = process.env.LANGTAIL_API_KEY,
  }) {
    const {
      apiKey,
      organization
    } = options;
    const KEY = 'lt-eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJpc3MiOiJsYW5ndGFpbC1hcGkiLCJzdWIiOiJjbHMxamQ0dGkwMDA3bDAwOHN6dWloODF0IiwianRpIjoiY2x0eDQ1dDcxMDAwM2swMGd6dTFoOG1ycCIsInJhdGVMaW1pdCI6bnVsbCwiaWF0IjoxNzEwNzc2NTA3fQ.BBY_PztlTc6bJI6Xyp_xgU4gihujf7qQOHRM22EEmt2qaFd6u2twzvHZ8s4VOZ-Pv2Ue6kRGixOkNNdcUv3G5g'

    const optionsToPass = {

      baseURL: "https://proxy.langtail.com/v1",
      apiKey: KEY
    };
    console.log(options)
    super(optionsToPass);

    this.langtail = new Langtail({
      apiKey,
      baseURL: 'https://proxy.langtail.com/v1',
    });

    return this

  }



}