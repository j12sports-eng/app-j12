/**
 * @typedef {Object} PersonName
 * @property {string|null} [fullName]
 * @property {string|null} [socialName]
 * @property {string|null} [displayName]
 */

/**
 * @typedef {Object} PersonDocument
 * @property {string|null} [type]
 * @property {string|null} [value]
 */

/**
 * @typedef {Object} PersonContact
 * @property {string|null} [email]
 * @property {string|null} [phone]
 * @property {string|null} [mobilePhone]
 */

/**
 * @typedef {Object} PersonAddress
 * @property {string|null} [zipCode]
 * @property {string|null} [street]
 * @property {string|null} [number]
 * @property {string|null} [complement]
 * @property {string|null} [district]
 * @property {string|null} [city]
 * @property {string|null} [state]
 * @property {string|null} [country]
 */

/**
 * @typedef {Object} PersonProfileRef
 * @property {string} type
 * @property {string|null} [id]
 * @property {boolean|null} [active]
 */

/**
 * Future architecture shape for a person.
 *
 * This is a structural contract only. It does not represent a database schema
 * and is not used by current APIs.
 *
 * @typedef {Object} PersonData
 * @property {string|null} [id]
 * @property {PersonName|null} [name]
 * @property {Array<PersonDocument>} [documents]
 * @property {PersonContact|null} [contact]
 * @property {PersonAddress|null} [address]
 * @property {Array<PersonProfileRef>} [profiles]
 * @property {string|null} [birthCity]
 * @property {string|null} [birthDate]
 * @property {string|null} [birthState]
 * @property {string|null} [nationality]
 * @property {string|null} [bloodType]
 * @property {string|null} [status]
 * @property {string|null} [createdAt]
 * @property {string|null} [updatedAt]
 */

module.exports = {};
