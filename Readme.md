# Slender-keeper
## Description
The service is designed to automate actions related to managing liquidations in the Slender pool. It regularly checks the status of borrowers and initiates liquidations for borrowers with zero-or-negative net position value (NPV).
## Installation
To set up and run this service locally or on a server, follow these steps:
1. **Clone the Repository**: Use git clone to clone the repository to your local machine.
```bash
git clone https://github.com/eq-lab/slender-keeper.git
```
2. **Install Dependencies**: Navigate to the project directory and install the required dependencies using yarn.
```bash
cd slender-keeper
yarn install
```
3. **Configuration**: Configure the service by setting envs (see below) or by updating the necessary parameters in the `src/consts.ts` file.
4. **Running the Service**: Start the service by running the following command:
```bash
yarn start
```
The service will start monitoring borrowers and executing liquidations.
## Usage
This service is designed to automate the process of monitoring of borrowers positions and initiating liquidations in the Soroban ecosystem. Here's an overview of how it works:
- The service periodically retrieves borrower positions.
- Borrowers with negative or zero NPV are identified for potential liquidation.
- The service checks the liquidator's balances.
- If the liquidator has sufficient balances, it initiates the liquidation process for the borrower.
- The service handles liquidation errors and updates the database with borrowers accordingly.
## Configuration
To configure the service for your specific environment, you'll need to set the following env or set values in the `src/consts.ts` file:
`CONTRACT_CREATION_LEDGER` - ledget at which Slender pool was created\
`POOL_ID` - Slender pool address\
`XLM_NATIVE` - address of XLM contract\
`SOROBAN_URL` - Sorban RPC URL\
`HORIZON_URL` - Horizon RPC URL\
`NETWORK_PASSPHRASE` - Soroban passphrase\
`LIQUIDATOR_ADDRESS` - liquidator's account address\
`LIQUIDATOR_SECRET` - liquidator's secret key
## License
This project is licensed under the MIT License - see the LICENSE file for details.