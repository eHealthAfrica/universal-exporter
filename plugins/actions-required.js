// turn actionsRequired object into a string of LF separated values
// original it would be: { common: { prop: true, prop2: false }, other: "..." }
function actionsRequired(row) {
  if (row.dispatch && row.dispatch.actionsRequired) {
    var prop = row.dispatch.actionsRequired;
    // convert the actionsRequired into a string of the keys
    var actionsRequired = [];

    if (prop.common) {
      actionsRequired = Object.keys(prop.common).reduce(function (acc, curr) {
        // put the key if it's true in the actionsRequired
        // and make sure the value is a bool
        var value = prop.common[curr];
        if (typeof value === 'string') {
          value = value.toLowerCase() === 'true';
        }

        if (value) {
          acc.push(curr);
        }

        return acc;
      }, []);
    }

    // return the value of "other"
    if (prop.other) {
      actionsRequired.push(prop.other);
    }

    row.dispatch.actionsRequired = actionsRequired.join('\n');
  }

  return row;
};

if (typeof exports !== 'undefined') {
  module.exports = actionsRequired;
} else if (typeof exporter !== 'undefined') {
  exporter.iterators.actionsRequired = actionsRequired;
}