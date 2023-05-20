const AdjustablePercentageControl = require('./AdjustablePercentageControl');

/**
 * @class
 */
class Blinds extends AdjustablePercentageControl {

    get categories() {
        return ['INTERIOR_BLIND'];
    }
}

module.exports = Blinds;