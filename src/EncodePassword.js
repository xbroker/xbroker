import sha256 from 'crypto-js/sha256';
import Base64 from 'crypto-js/enc-base64';
import readline from 'readline'
import process from 'process'

const salt = "Sh9Jp0sbyeqegDcwN2caKbcNuQR9"
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

function hashPassword(password) {
    const hsalt = Base64.stringify(sha256(salt))
    const hash = Base64.stringify(sha256(password + hsalt))
    return hash
}

export function encodePassword() {
    rl.question('Enter password: ', (password) => {
        const hpassword = hashPassword(password)
        console.log("Encoded password:", hpassword)
        rl.close()
        process.exit()
    })
}

export function decodeBase64(s) {
    return Base64.parse(s).toString()
}
