import { network } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const { ethers } = await network.connect();

  const [deployer] = await ethers.getSigners();
  const owner = process.env.INITIAL_OWNER || deployer.address;

  console.log("Deploying from:", deployer.address);
  console.log("Owner:", owner);

  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy(owner);
  await registry.waitForDeployment();

  const RevenueVault = await ethers.getContractFactory("RevenueVault");
  const vault = await RevenueVault.deploy(owner);
  await vault.waitForDeployment();

  console.log("AgentRegistry:", await registry.getAddress());
  console.log("RevenueVault:", await vault.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
