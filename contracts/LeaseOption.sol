// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LeaseOption — rent-to-own / lease-option agreement as code
/// @notice A tenant pays monthly rent into this contract. A fixed percentage
///         of every rent payment accrues as purchase credits. Once the full
///         lease term is paid, the tenant may exercise the purchase option by
///         paying (strikePrice − rentCredits − optionFee) — the entire contract
///         balance then flows to the landlord.
///
///         This contract governs the *payment mechanics* of a lease-option
///         deal. It does NOT transfer legal title by itself. Pair it with a
///         DeedNFT transfer (see thebullbrew/crypto-deed-nft-template) and a
///         properly drafted lease-option agreement for the full close.
contract LeaseOption {
    address public immutable tenant;
    address public immutable landlord;
    uint256 public immutable monthlyRent;
    uint256 public immutable termMonths;
    uint256 public immutable strikePrice;
    uint256 public immutable rentCreditBps; // e.g. 2500 = 25% of each rent payment credited
    uint256 public immutable optionFee; // msg.value at deploy, held in contract

    uint256 public paidMonths;
    uint256 public rentCredits;
    bool public exercised;

    event RentPaid(uint256 indexed month, uint256 credits);
    event OptionExercised(uint256 amountDue);

    error OnlyTenant();
    error LeaseComplete();
    error AlreadyExercised();
    error TermNotComplete();
    error WrongRentAmount();
    error WrongExerciseAmount();
    error NoOptionFee();

    modifier onlyTenant() {
        if (msg.sender != tenant) revert OnlyTenant();
        _;
    }

    /// @param _tenant The renter / future buyer.
    /// @param _landlord Receives rents and the final payout.
    /// @param _monthlyRent Exact wei due each month.
    /// @param _termMonths Number of monthly payments before the option is exercisable.
    /// @param _strikePrice Agreed purchase price in wei.
    /// @param _rentCreditBps Basis points of each rent payment credited toward
    ///        purchase (<= 10000). 2500 = 25%.
    /// @dev Deploy with msg.value = option fee (> 0), held in the contract and
    ///      credited against the strike price at exercise.
    constructor(
        address _tenant,
        address _landlord,
        uint256 _monthlyRent,
        uint256 _termMonths,
        uint256 _strikePrice,
        uint256 _rentCreditBps
    ) payable {
        require(_tenant != address(0), "LeaseOption: zero tenant");
        require(_landlord != address(0), "LeaseOption: zero landlord");
        require(_monthlyRent > 0, "LeaseOption: zero rent");
        require(_termMonths > 0, "LeaseOption: zero term");
        require(_strikePrice > 0, "LeaseOption: zero strike");
        require(_rentCreditBps <= 10000, "LeaseOption: credit bps > 10000");
        if (msg.value == 0) revert NoOptionFee();

        tenant = _tenant;
        landlord = _landlord;
        monthlyRent = _monthlyRent;
        termMonths = _termMonths;
        strikePrice = _strikePrice;
        rentCreditBps = _rentCreditBps;
        optionFee = msg.value;
    }

    /// @notice Pay one month of rent. Exact amount only, tenant only, in order.
    function payRent() external payable onlyTenant {
        if (exercised) revert AlreadyExercised();
        if (paidMonths >= termMonths) revert LeaseComplete();
        if (msg.value != monthlyRent) revert WrongRentAmount();

        paidMonths += 1;
        uint256 credits = (monthlyRent * rentCreditBps) / 10000;
        rentCredits += credits;

        emit RentPaid(paidMonths, credits);
    }

    /// @notice Exercise the purchase option after the full term is paid.
    /// @dev amountDue = strikePrice − rentCredits − optionFee, floored at 0.
    ///      The tenant pays amountDue; the entire contract balance goes to the
    ///      landlord. Rent accrual stops permanently.
    function exerciseOption() external payable onlyTenant {
        if (exercised) revert AlreadyExercised();
        if (paidMonths != termMonths) revert TermNotComplete();

        uint256 credited = rentCredits + optionFee;
        uint256 amountDue = strikePrice > credited ? strikePrice - credited : 0;
        if (msg.value != amountDue) revert WrongExerciseAmount();

        exercised = true;

        uint256 payout = address(this).balance;
        (bool ok, ) = landlord.call{value: payout}("");
        require(ok, "LeaseOption: payout failed");

        emit OptionExercised(amountDue);
    }

    /// @notice Current deal status.
    /// @return _paidMonths Months of rent paid so far.
    /// @return _rentCredits Purchase credits accrued from rent.
    /// @return _amountDue Wei still required to exercise (strike − credits − fee, floor 0).
    /// @return _exercised Whether the option has been exercised.
    function status()
        external
        view
        returns (
            uint256 _paidMonths,
            uint256 _rentCredits,
            uint256 _amountDue,
            bool _exercised
        )
    {
        _paidMonths = paidMonths;
        _rentCredits = rentCredits;
        uint256 credited = rentCredits + optionFee;
        _amountDue = strikePrice > credited ? strikePrice - credited : 0;
        _exercised = exercised;
    }
}
