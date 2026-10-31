// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Certificate {
    struct Record {
        address issuer;
        uint256 issuedAt;
        bool revoked;
    }

    address public owner;
    mapping(bytes32 => Record) private records;

    event CertificateIssued(bytes32 indexed certHash, address indexed issuer, uint256 issuedAt);
    event CertificateRevoked(bytes32 indexed certHash);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // University certificate ka hash store karta hai
    function issueCertificate(bytes32 certHash) external onlyOwner {
        require(records[certHash].issuer == address(0), "Already issued");
        records[certHash] = Record(msg.sender, block.timestamp, false);
        emit CertificateIssued(certHash, msg.sender, block.timestamp);
    }

    // Certificate ko revoke (cancel) karta hai
    function revokeCertificate(bytes32 certHash) external onlyOwner {
        require(records[certHash].issuer != address(0), "Not found");
        records[certHash].revoked = true;
        emit CertificateRevoked(certHash);
    }

    // Hash check karta hai: valid, revoked status, issuer aur issue date
    function verifyCertificate(bytes32 certHash)
        external
        view
        returns (bool valid, bool revoked, address issuer, uint256 issuedAt)
    {
        Record memory r = records[certHash];
        valid = r.issuer != address(0) && !r.revoked;
        return (valid, r.revoked, r.issuer, r.issuedAt);
    }
}