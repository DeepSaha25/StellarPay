#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, Map, Symbol, Vec,
};

#[contract]
pub struct EarlyWageContract;

const EMP_COUNT: Symbol = symbol_short!("EMP_COUNT");
const EMP_DETAILS: Symbol = symbol_short!("EMP_DET");
const WALLET_TO_ID: Symbol = symbol_short!("wal2id");
const SUPPORTED_TOKENS: Symbol = symbol_short!("SUP_TOK");
const ADMIN: Symbol = symbol_short!("ADMIN");

#[contracttype]
pub struct EmployeeDetails {
    pub emp_id: u128,
    pub wallet: Address,
    pub rem_salary: u128,
    pub salary_token: Address,
}

#[contracttype]
pub struct TokenInfo {
    pub address: Address,
    pub symbol: soroban_sdk::String,
    pub decimals: u32,
}

#[contractimpl]
impl EarlyWageContract {
    // ============================================
    // INITIALIZATION — call once after deploy
    // ============================================

    /// Initialize contract with an admin address.
    /// Can only be called once.
    pub fn initialize(e: Env, admin: Address) {
        if e.storage().instance().has(&ADMIN) {
            panic!("Already initialized");
        }
        admin.require_auth();
        e.storage().instance().set(&ADMIN, &admin);
    }

    /// Get the current admin address
    pub fn get_admin(e: Env) -> Address {
        e.storage()
            .instance()
            .get(&ADMIN)
            .expect("Contract not initialized")
    }

    // ============================================
    // TOKEN MANAGEMENT (admin only)
    // ============================================

    /// Add a supported token — only stored admin can call this
    pub fn add_supported_token(
        e: Env,
        token_address: Address,
        symbol: soroban_sdk::String,
        decimals: u32,
    ) {
        // Verify against stored admin — not a passed-in address
        let admin: Address = e
            .storage()
            .instance()
            .get(&ADMIN)
            .expect("Contract not initialized");
        admin.require_auth();

        let mut tokens: Vec<TokenInfo> = e
            .storage()
            .instance()
            .get(&SUPPORTED_TOKENS)
            .unwrap_or(Vec::new(&e));

        tokens.push_back(TokenInfo {
            address: token_address,
            symbol,
            decimals,
        });

        e.storage().instance().set(&SUPPORTED_TOKENS, &tokens);
    }

    /// Get all supported tokens (public read)
    pub fn get_supported_tokens(e: Env) -> Vec<TokenInfo> {
        e.storage()
            .instance()
            .get(&SUPPORTED_TOKENS)
            .unwrap_or(Vec::new(&e))
    }

    // ============================================
    // EMPLOYEE MANAGEMENT
    // ============================================

    pub fn register_employee(e: Env, wallet: Address, salary: u128, salary_token: Address) {
        let mut wallet_map: Map<Address, u128> = e
            .storage()
            .instance()
            .get(&WALLET_TO_ID)
            .unwrap_or(Map::new(&e));

        if wallet_map.contains_key(wallet.clone()) {
            panic!("Wallet already registered");
        }

        let mut emp_id: u128 = e.storage().instance().get(&EMP_COUNT).unwrap_or(0);
        emp_id += 1;

        let mut emp_map: Map<u128, EmployeeDetails> = e
            .storage()
            .instance()
            .get(&EMP_DETAILS)
            .unwrap_or(Map::new(&e));

        emp_map.set(
            emp_id,
            EmployeeDetails {
                emp_id,
                wallet: wallet.clone(),
                rem_salary: salary,
                salary_token,
            },
        );
        wallet_map.set(wallet, emp_id);

        e.storage().instance().set(&EMP_DETAILS, &emp_map);
        e.storage().instance().set(&WALLET_TO_ID, &wallet_map);
        e.storage().instance().set(&EMP_COUNT, &emp_id);
    }

    // ============================================
    // VAULT OPERATIONS
    // ============================================

    pub fn deposit_to_vault(e: Env, from: Address, amount: i128, token: Address) {
        from.require_auth();

        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let client = token::Client::new(&e, &token);
        // vulnerability or security fix issue :- Check user balance before cross-contract deposit
        if client.balance(&from) < amount { panic!("Insufficient balance"); }
        client.transfer(&from, &e.current_contract_address(), &amount);
    }

    pub fn request_advance(e: &Env, emp_id: u128, amount: i128, token: Address) {
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let mut emp_map: Map<u128, EmployeeDetails> = e
            .storage()
            .instance()
            .get(&EMP_DETAILS)
            .unwrap_or(Map::new(e));

        let mut emp = emp_map.get(emp_id).unwrap();

        if amount as u128 >= emp.rem_salary {
            panic!("Requested amount exceeded remaining salary");
        }

        let fee = amount * 125 / 10000;
        let final_amount = amount - fee;

        let client = token::Client::new(e, &token);
        client.transfer(&e.current_contract_address(), &emp.wallet, &final_amount);

        emp.rem_salary -= amount as u128;
        emp_map.set(emp_id, emp);

        e.storage().instance().set(&EMP_DETAILS, &emp_map);
    }

    pub fn vault_balance(e: Env, token: Address) -> i128 {
        let client = token::Client::new(&e, &token);
        client.balance(&e.current_contract_address())
    }

    pub fn vault_balances_multi(e: Env, tokens: Vec<Address>) -> Map<Address, i128> {
        let mut balances: Map<Address, i128> = Map::new(&e);
        for i in 0..tokens.len() {
            let token_addr = tokens.get(i).unwrap();
            let client = token::Client::new(&e, &token_addr);
            let balance = client.balance(&e.current_contract_address());
            balances.set(token_addr, balance);
        }
        balances
    }

    // ============================================
    // EMPLOYEE QUERIES
    // ============================================

    pub fn get_emp_details(e: Env, emp_id: u128) -> EmployeeDetails {
        let emp_map: Map<u128, EmployeeDetails> = e
            .storage()
            .instance()
            .get(&EMP_DETAILS)
            .unwrap_or(Map::new(&e));
        emp_map.get(emp_id).unwrap()
    }

    pub fn get_emp_id_by_wallet(e: Env, wallet: Address) -> u128 {
        let wallet_map: Map<Address, u128> = e
            .storage()
            .instance()
            .get(&WALLET_TO_ID)
            .unwrap_or(Map::new(&e));
        wallet_map.get(wallet).unwrap_or(0)
    }

    pub fn get_remaining_salary(e: Env, emp_id: u128) -> u128 {
        let emp_map: Map<u128, EmployeeDetails> = e
            .storage()
            .instance()
            .get(&EMP_DETAILS)
            .unwrap_or(Map::new(&e));
        let emp = emp_map.get(emp_id).unwrap();
        emp.rem_salary
    }

    pub fn release_remaining_salary(e: Env, emp_id: u128, token: Address, salary: u128) {
        let mut emp_map: Map<u128, EmployeeDetails> = e
            .storage()
            .instance()
            .get(&EMP_DETAILS)
            .unwrap_or(Map::new(&e));

        let mut emp = emp_map.get(emp_id).unwrap();

        if emp.rem_salary == 0 {
            panic!("No remaining salary to release");
        }

        let client = token::Client::new(&e, &token);
        client.transfer(
            &e.current_contract_address(),
            &emp.wallet,
            &(emp.rem_salary as i128),
        );

        emp.rem_salary = salary;
        emp_map.set(emp_id, emp);

        e.storage().instance().set(&EMP_DETAILS, &emp_map);
    }
}