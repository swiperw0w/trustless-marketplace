import {
  createPublicClient,
  createWalletClient,
  custom,
  parseEther,
  formatEther,
  http
} from "https://esm.sh/viem";

import { sepolia } from "https://esm.sh/viem/chains";
import { abi } from "./abi.js";

console.log("app loaded");

const contractAddress = "0x772857301abC99E453918f2A6112C8D6d3615702";

let account = null;

if (!window.ethereum) {
  alert("Please install MetaMask");
}

// Clients
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http("https://ethereum-sepolia-rpc.publicnode.com")
});

const walletClient = createWalletClient({
  chain: sepolia,
  transport: custom(window.ethereum)
});

// CONNECT WALLET
document.getElementById("connectBtn").onclick = async () => {
  try {
    const accounts = await walletClient.requestAddresses();
    account = accounts[0];

    document.getElementById("account").innerText =
      "Connected: " + account;

    await loadPlatformInfo();
    await loadOrders();
  } catch (err) {
    console.error(err);
  }
};

// CREATE ORDER
document.getElementById("createBtn").onclick = async () => {
  try {
    const description = document.getElementById("description").value;
    const amount = document.getElementById("amount").value;

    await walletClient.writeContract({
      address: contractAddress,
      abi,
      functionName: "createOrder",
      args: [description, parseEther(amount)],
      account
    });

    alert("Order created!");

    await loadOrders();
  } catch (err) {
    console.error(err);
  }
};

// WITHDRAW FEES
document.getElementById("withdrawBtn").onclick = async () => {
  try {
    await walletClient.writeContract({
      address: contractAddress,
      abi,
      functionName: "withdrawFees",
      account
    });

    alert("Fees withdrawn!");
    await loadPlatformInfo();
  } catch (err) {
    console.error(err);
  }
};

// LOAD PLATFORM INFO
async function loadPlatformInfo() {
  try {
    const fee = await publicClient.readContract({
      address: contractAddress,
      abi,
      functionName: "platformFee"
    });

    const acc = await publicClient.readContract({
      address: contractAddress,
      abi,
      functionName: "accumulatedFees"
    });

    const owner = await publicClient.readContract({
      address: contractAddress,
      abi,
      functionName: "owner"
    });

    document.getElementById("platformFee").innerText =
      fee.toString();

    document.getElementById("accFees").innerText =
      formatEther(acc);

    if (
      account &&
      account.toLowerCase() === owner.toLowerCase()
    ) {
      document.getElementById("withdrawBtn").style.display =
        "inline-block";
    } else {
      document.getElementById("withdrawBtn").style.display =
        "none";
    }
  } catch (err) {
    console.error(err);
  }
}

// LOAD ORDERS
async function loadOrders() {
  try {
    const counter = await publicClient.readContract({
      address: contractAddress,
      abi,
      functionName: "orderCounter"
    });

    const container = document.getElementById("orders");
    container.innerHTML = "";

    for (let i = 1n; i <= counter; i++) {
      try {
        const order = await publicClient.readContract({
          address: contractAddress,
          abi,
          functionName: "orders",
          args: [i]
        });

        const client = order[0];
        const freelancer = order[1];
        const description = order[2];
        const amount = order[3];
        const status = order[4];

        let statusText = "";
        let statusClass = "";

        if (status === 0n) {
          statusText = "Open";
          statusClass = "status-open";
        }
        if (status === 1n) {
          statusText = "Accepted";
          statusClass = "status-accepted";
        }
        if (status === 2n) {
          statusText = "Funded";
          statusClass = "status-funded";
        }
        if (status === 3n) {
          statusText = "Completed";
          statusClass = "status-completed";
        }

        const card = document.createElement("div");
        card.className = "card";

        card.innerHTML = `
          <p><strong>Order #${i}</strong></p>
          <p>Client: ${client}</p>
          <p>Freelancer: ${freelancer}</p>
          <p>Description: ${description}</p>
          <p>Amount: ${formatEther(amount)} ETH</p>
          <p>Status: <span class="${statusClass}">${statusText}</span></p>
        `;

        // ACCEPT
        if (
          status === 0n &&
          account &&
          account.toLowerCase() !== client.toLowerCase()
        ) {
          const btn = document.createElement("button");
          btn.innerText = "Accept";
          btn.onclick = async () => {
            await walletClient.writeContract({
              address: contractAddress,
              abi,
              functionName: "acceptOrder",
              args: [i],
              account
            });
            await loadOrders();
          };
          card.appendChild(btn);
        }

        // FUND
        if (
          status === 1n &&
          account &&
          account.toLowerCase() === client.toLowerCase()
        ) {
          const btn = document.createElement("button");
          btn.innerText = "Fund";
          btn.onclick = async () => {
            await walletClient.writeContract({
              address: contractAddress,
              abi,
              functionName: "fundOrder",
              args: [i],
              value: amount,
              account
            });
            await loadOrders();
          };
          card.appendChild(btn);
        }

        // CONFIRM COMPLETION
        if (
          status === 2n &&
          account &&
          account.toLowerCase() === client.toLowerCase()
        ) {
          const btn = document.createElement("button");
          btn.innerText = "Confirm Completion";
          btn.onclick = async () => {
            await walletClient.writeContract({
              address: contractAddress,
              abi,
              functionName: "confirmCompletion",
              args: [i],
              account
            });
            await loadOrders();
            await loadPlatformInfo();
          };
          card.appendChild(btn);
        }

        container.appendChild(card);
      } catch (err) {
        console.error("Error loading order:", err);
      }
    }
  } catch (err) {
    console.error(err);
  }
}
