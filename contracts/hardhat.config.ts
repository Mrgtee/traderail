import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import * as dotenv from "dotenv";

dotenv.config();

const privateKey = process.env.PRIVATE_KEY;
const validPrivateKey =
  privateKey && /^0x[0-9a-fA-F]{64}$/.test(privateKey) ? privateKey : undefined;

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    xlayer: {
      type: "http",
      chainType: "l1",
      url: process.env.XLAYER_RPC_URL!,
      accounts: validPrivateKey ? [validPrivateKey] : []
    },
    xlayerTestnet: {
      type: "http",
      chainType: "l1",
      url: process.env.XLAYER_TESTNET_RPC_URL!,
      accounts: validPrivateKey ? [validPrivateKey] : []
    }
  }
});
