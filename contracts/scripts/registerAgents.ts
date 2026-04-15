import { network } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const { ethers } = await network.connect();

  const registryAddress = process.env.AGENT_REGISTRY_ADDRESS!;
  const agentWallet = process.env.AGENT_WALLET!;
  const publicApiBase = process.env.PUBLIC_API_BASE!;

  const registry = await ethers.getContractAt("AgentRegistry", registryAddress);

  const entries = [
    {
      role: "Execution Guard",
      name: "Scout Agent",
      endpoint: `${publicApiBase}/x402/scout`,
      metadataURI: "ipfs://traderail/scout"
    },
    {
      role: "Router",
      name: "Router Agent",
      endpoint: `${publicApiBase}/x402/router-quote`,
      metadataURI: "ipfs://traderail/router"
    },
    {
      role: "Treasury",
      name: "Treasury Agent",
      endpoint: `${publicApiBase}/api/overview`,
      metadataURI: "ipfs://traderail/treasury"
    }
  ];

  for (const item of entries) {
    const tx = await registry.registerAgent(
      item.role,
      item.name,
      agentWallet,
      item.endpoint,
      item.metadataURI
    );

    await tx.wait();
    console.log(`Registered ${item.name}: ${tx.hash}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
