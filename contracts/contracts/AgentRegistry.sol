// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AgentRegistry is Ownable {
    struct Agent {
        uint256 id;
        string role;
        string name;
        address agentWallet;
        string endpoint;
        string metadataURI;
        bool active;
    }

    uint256 public agentCount;
    mapping(uint256 => Agent) private agents;

    event AgentRegistered(
        uint256 indexed id,
        string role,
        string name,
        address indexed agentWallet,
        string endpoint,
        string metadataURI
    );

    event AgentUpdated(
        uint256 indexed id,
        string role,
        string name,
        address indexed agentWallet,
        string endpoint,
        string metadataURI,
        bool active
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    function registerAgent(
        string calldata role,
        string calldata name,
        address agentWallet,
        string calldata endpoint,
        string calldata metadataURI
    ) external onlyOwner returns (uint256) {
        require(agentWallet != address(0), "bad wallet");
        require(bytes(name).length > 0, "name required");

        agentCount += 1;

        agents[agentCount] = Agent({
            id: agentCount,
            role: role,
            name: name,
            agentWallet: agentWallet,
            endpoint: endpoint,
            metadataURI: metadataURI,
            active: true
        });

        emit AgentRegistered(agentCount, role, name, agentWallet, endpoint, metadataURI);
        return agentCount;
    }

    function updateAgent(
        uint256 id,
        string calldata role,
        string calldata name,
        address agentWallet,
        string calldata endpoint,
        string calldata metadataURI,
        bool active
    ) external onlyOwner {
        require(agents[id].id != 0, "not found");
        require(agentWallet != address(0), "bad wallet");

        agents[id].role = role;
        agents[id].name = name;
        agents[id].agentWallet = agentWallet;
        agents[id].endpoint = endpoint;
        agents[id].metadataURI = metadataURI;
        agents[id].active = active;

        emit AgentUpdated(id, role, name, agentWallet, endpoint, metadataURI, active);
    }

    function getAgent(uint256 id) external view returns (Agent memory) {
        require(agents[id].id != 0, "not found");
        return agents[id];
    }
}
