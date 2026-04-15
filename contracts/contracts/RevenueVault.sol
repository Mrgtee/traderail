// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract RevenueVault is Ownable {
    using SafeERC20 for IERC20;

    event NativeReceived(address indexed from, uint256 amount);
    event NativeWithdrawn(address indexed to, uint256 amount);
    event ERC20Withdrawn(address indexed token, address indexed to, uint256 amount);
    event ERC20Distributed(address indexed token, address[] recipients, uint256[] amounts);

    constructor(address initialOwner) Ownable(initialOwner) {}

    receive() external payable {
        emit NativeReceived(msg.sender, msg.value);
    }

    function withdrawNative(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "bad to");
        require(address(this).balance >= amount, "insufficient");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "native transfer failed");
        emit NativeWithdrawn(to, amount);
    }

    function withdrawERC20(address token, address to, uint256 amount) external onlyOwner {
        require(token != address(0), "bad token");
        require(to != address(0), "bad to");
        IERC20(token).safeTransfer(to, amount);
        emit ERC20Withdrawn(token, to, amount);
    }

    function distributeERC20(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner {
        require(token != address(0), "bad token");
        require(recipients.length == amounts.length, "length mismatch");

        IERC20 erc20 = IERC20(token);

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "bad recipient");
            erc20.safeTransfer(recipients[i], amounts[i]);
        }

        emit ERC20Distributed(token, recipients, amounts);
    }
}
